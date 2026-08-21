import { Injectable, Logger } from "@nestjs/common";
import { InteractionType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AnimeDto } from "../anime/dto/anime.dto";
import { AnimeService } from "../anime/anime.service";
import { calculateCosineSimilarity } from "./algorithms/cosine-similarity.util";

// Este archivo contiene la lógica principal del recomendador de AnimeDev.
// Aquí se combinan preferencias explícitas e interacciones reales para generar
// sugerencias personalizadas sin depender de variables demográficas no validadas.

type UserSettingsSnapshot = {
  preferredGenres: number[];
  preferredDurations: string[];
};

type InteractionRecord = {
  userId: string;
  animeId: number;
  type: InteractionType;
  payload: unknown;
};

type RecommendationMeta = {
  algorithm: "hybrid_cosine_preferences";
  strategy: "collaborative" | "hybrid" | "cold_start" | "fallback";
  count: number;
};

// Este servicio es el corazón del motor de recomendaciones.
// Su responsabilidad es decidir qué estrategia aplicar y ordenar los candidatos.
@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);

  /**
   * Peso base asignado a cada tipo de interacción.
   *
   * Las señales positivas aumentan la afinidad del usuario con un anime,
   * mientras que las señales negativas reducen dicha afinidad.
   */
  private readonly WEIGHTS: Record<InteractionType, number> = {
    FAVORITE: 5,
    VIEW: 0.35,
    TRIVIA_SCORE: 2,
    DISLIKE: -3,
    UNFAVORITE: -2,
  };

  // La puntuación de una trivia se transforma a un valor entre 0 y 3.
  private readonly TRIVIA_SCORE_MAX_WEIGHT = 3;
  private readonly TRIVIA_SCORE_SCALE_MAX = 10;

  // Umbrales para decidir cuándo existe suficiente información colaborativa.
  private readonly MIN_GLOBAL_INTERACTIONS = 5;
  private readonly MIN_USER_INTERACTIONS_FOR_COLLAB = 3;

  // Límites usados para controlar el tamaño de los conjuntos de candidatos.
  private readonly COLD_START_POOL_LIMIT = 25;
  private readonly MAX_DETAIL_CANDIDATES = 12;
  private readonly MAX_NEIGHBORS = 20;
  private readonly TARGET_RECOMMENDATIONS = 10;

  /**
   * Pesos de la estrategia híbrida.
   *
   * El componente colaborativo tiene el mayor peso porque representa patrones
   * de comportamiento compartidos entre usuarios. Las preferencias explícitas
   * de género y duración se utilizan para ajustar el orden final.
   *
   * Las variables demográficas no participan en el ranking porque el prototipo
   * no dispone de evidencia empírica suficiente para establecer asociaciones
   * entre edad, género, región y preferencias de anime.
   */
  private readonly HYBRID_CF_WEIGHT = 0.65;
  private readonly HYBRID_GENRE_WEIGHT = 0.25;
  private readonly HYBRID_DURATION_WEIGHT = 0.1;

  /**
   * Pesos utilizados durante el inicio en frío.
   *
   * En ausencia de historial suficiente, se priorizan los géneros y duraciones
   * elegidos por el usuario. La popularidad se usa únicamente como desempate.
   */
  private readonly COLD_START_GENRE_WEIGHT = 0.77;
  private readonly COLD_START_DURATION_WEIGHT = 0.2;
  private readonly COLD_START_POPULARITY_WEIGHT = 0.03;

  constructor(
    private readonly prisma: PrismaService,
    private readonly animeService: AnimeService,
  ) {}

  // Este es el punto de entrada del recomendador.
  // Primero se revisa si existe suficiente señal colaborativa. Si todavía no
  // existe, se usa el inicio en frío guiado por preferencias explícitas.
  async getAdaptiveRecommendations(userId: string, requestId?: string) {
    const [allInteractions, settingsRaw] = await Promise.all([
      this.prisma.userInteraction.findMany({
        select: {
          userId: true,
          animeId: true,
          type: true,
          payload: true,
        },
      }),
      this.prisma.userSettings.findUnique({
        where: { userId },
        select: {
          preferredGenres: true,
          preferredDurations: true,
        },
      }),
    ]);

    const settings: UserSettingsSnapshot = {
      preferredGenres: settingsRaw?.preferredGenres ?? [],
      preferredDurations: settingsRaw?.preferredDurations ?? [],
    };

    const userVectors = this.buildUserVectors(allInteractions);
    const currentUserVector = userVectors.get(userId);
    const userInteractionCount = currentUserVector?.size ?? 0;

    const hasPreferences =
      settings.preferredGenres.length > 0 ||
      settings.preferredDurations.length > 0;

    const hasEnoughCollaborativeSignal =
      allInteractions.length >= this.MIN_GLOBAL_INTERACTIONS &&
      userInteractionCount >= this.MIN_USER_INTERACTIONS_FOR_COLLAB;

    if (!hasEnoughCollaborativeSignal) {
      return this.getColdStartRecommendations(
        settings,
        requestId,
        hasPreferences,
      );
    }

    const collaborativeScores = this.calculateCollaborativeScores(
      userId,
      userVectors,
    );

    if (collaborativeScores.size === 0) {
      this.logger.log(
        `No se encontraron candidatos colaborativos para el usuario ${userId}; se usará inicio en frío.`,
      );

      return this.getColdStartRecommendations(
        settings,
        requestId,
        hasPreferences,
      );
    }

    // Se conservan los candidatos con mayor puntuación colaborativa antes de
    // recuperar sus detalles desde la capa multiproveedor del módulo de anime.
    const sortedCollaborative = Array.from(collaborativeScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.MAX_DETAIL_CANDIDATES);

    const animeDetails = await this.fetchAnimeDetails(
      sortedCollaborative.map(([animeId]) => animeId),
      requestId,
    );

    if (animeDetails.length === 0) {
      this.logger.warn(
        `No fue posible recuperar los detalles de los candidatos del usuario ${userId}; se usará el respaldo general.`,
      );

      return this.getTopFallback(requestId, "empty_hybrid_details");
    }

    // La puntuación colaborativa se normaliza a [0, 1] para combinarla con
    // género y duración, que también se calculan sobre esa misma escala.
    const normalizedCollaborative = this.minMaxNormalize(collaborativeScores);

    const reranked = animeDetails
      .map((anime) => {
        const collaborativeScore = normalizedCollaborative.get(anime.id) ?? 0;
        const genreScore = this.getGenreMatchScore(
          anime,
          settings.preferredGenres,
        );
        const durationScore = this.getDurationMatchScore(
          anime,
          settings.preferredDurations,
        );

        const finalScore =
          collaborativeScore * this.HYBRID_CF_WEIGHT +
          genreScore * this.HYBRID_GENRE_WEIGHT +
          durationScore * this.HYBRID_DURATION_WEIGHT;

        return { anime, finalScore };
      })
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, this.TARGET_RECOMMENDATIONS)
      .map((item) => item.anime);

    const strategy: RecommendationMeta["strategy"] = hasPreferences
      ? "hybrid"
      : "collaborative";

    if (reranked.length === 0) {
      this.logger.warn(
        `El reranqueo no produjo resultados para el usuario ${userId}; se usará el respaldo general.`,
      );

      return this.getTopFallback(requestId, "empty_hybrid_scores");
    }

    return {
      data: reranked,
      meta: {
        algorithm: "hybrid_cosine_preferences",
        strategy,
        count: reranked.length,
      } satisfies RecommendationMeta,
    };
  }

  // Aquí se convierten las interacciones de cada usuario en un vector disperso.
  // Cada anime funciona como una dimensión y su valor corresponde a la suma de
  // las señales registradas: favorito, vista, rechazo o resultado de trivia.
  private buildUserVectors(allInteractions: InteractionRecord[]) {
    const userVectors = new Map<string, Map<number, number>>();
    const seenViews = new Map<string, Set<number>>();

    for (const record of allInteractions) {
      if (!userVectors.has(record.userId)) {
        userVectors.set(record.userId, new Map());
      }

      // Una visualización solo se contabiliza una vez por usuario y anime.
      // Esto evita que abrir repetidamente una misma ficha domine el perfil.
      if (record.type === InteractionType.VIEW) {
        if (!seenViews.has(record.userId)) {
          seenViews.set(record.userId, new Set());
        }

        const viewsForUser = seenViews.get(record.userId)!;

        if (viewsForUser.has(record.animeId)) {
          continue;
        }

        viewsForUser.add(record.animeId);
      }

      const animeScores = userVectors.get(record.userId)!;
      const scoreToAdd =
        record.type === InteractionType.TRIVIA_SCORE
          ? this.getTriviaInteractionWeight(record.payload)
          : this.WEIGHTS[record.type];

      const currentScore = animeScores.get(record.animeId) ?? 0;
      animeScores.set(record.animeId, currentScore + scoreToAdd);
    }

    return userVectors;
  }

  // Convierte el desempeño de una trivia en una señal positiva entre 0 y 3.
  // Si el registro antiguo no tiene una estructura utilizable, se conserva el
  // peso base de TRIVIA_SCORE para no descartar interacciones ya almacenadas.
  private getTriviaInteractionWeight(payload: unknown): number {
    if (!payload || typeof payload !== "object") {
      return this.WEIGHTS.TRIVIA_SCORE;
    }

    const payloadData = payload as {
      score?: number;
      totalQuestions?: number;
    };

    const numericScore = payloadData.score;
    const totalQuestions = payloadData.totalQuestions;

    if (typeof numericScore !== "number" || Number.isNaN(numericScore)) {
      return this.WEIGHTS.TRIVIA_SCORE;
    }

    if (
      typeof totalQuestions === "number" &&
      !Number.isNaN(totalQuestions) &&
      totalQuestions > 0
    ) {
      const accuracy = Math.max(
        0,
        Math.min(1, numericScore / totalQuestions),
      );

      return accuracy * this.TRIVIA_SCORE_MAX_WEIGHT;
    }

    const normalizedScore =
      Math.min(Math.max(numericScore, 0), this.TRIVIA_SCORE_SCALE_MAX) /
      this.TRIVIA_SCORE_SCALE_MAX;

    return normalizedScore * this.TRIVIA_SCORE_MAX_WEIGHT;
  }

  // Aquí se compara al usuario actual con otros perfiles mediante similitud
  // coseno. Los animes valorados por usuarios similares se convierten en
  // candidatos siempre que el usuario actual no haya interactuado con ellos.
  private calculateCollaborativeScores(
    userId: string,
    userVectors: Map<string, Map<number, number>>,
  ): Map<number, number> {
    const currentUserVector = userVectors.get(userId);

    if (!currentUserVector || currentUserVector.size === 0) {
      return new Map();
    }

    const userSimilarities = new Map<string, number>();

    for (const [otherUserId, otherUserVector] of userVectors.entries()) {
      if (otherUserId === userId) continue;

      const similarity = calculateCosineSimilarity(
        currentUserVector,
        otherUserVector,
      );

      userSimilarities.set(otherUserId, similarity);
    }

    // Solo se consideran vecinos con similitud positiva y se limita su número
    // para mantener controlado el costo del cálculo.
    const topNeighbors = Array.from(userSimilarities.entries())
      .filter(([, similarity]) => similarity > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.MAX_NEIGHBORS);

    const scoreSums = new Map<number, number>();
    const absSimilaritySums = new Map<number, number>();

    for (const [otherUserId, similarity] of topNeighbors) {
      const otherUserVector = userVectors.get(otherUserId);
      if (!otherUserVector) continue;

      for (const [animeId, score] of otherUserVector.entries()) {
        // Se excluyen títulos que el usuario actual ya vio, marcó o rechazó.
        if (currentUserVector.has(animeId)) continue;

        scoreSums.set(
          animeId,
          (scoreSums.get(animeId) ?? 0) + similarity * score,
        );

        absSimilaritySums.set(
          animeId,
          (absSimilaritySums.get(animeId) ?? 0) + Math.abs(similarity),
        );
      }
    }

    const predictedScores = new Map<number, number>();

    for (const [animeId, scoreSum] of scoreSums.entries()) {
      const similarityTotal = absSimilaritySums.get(animeId) ?? 0;
      if (similarityTotal === 0) continue;

      predictedScores.set(animeId, scoreSum / similarityTotal);
    }

    return predictedScores;
  }

  // Este flujo se usa cuando el usuario todavía no tiene suficientes
  // interacciones. Se toma un conjunto de títulos populares y se reranquea
  // con base en géneros y duraciones elegidos explícitamente.
  private async getColdStartRecommendations(
    settings: UserSettingsSnapshot,
    requestId: string | undefined,
    hasAnySignal: boolean,
  ) {
    if (!hasAnySignal) {
      return this.getTopFallback(requestId, "no_personalization_signal");
    }

    try {
      const topPool = await this.animeService.getTop(
        this.COLD_START_POOL_LIMIT,
        requestId,
      );

      const topPoolSize = topPool.data.length;

      const reranked = topPool.data
        .map((anime, index) => {
          const genreScore = this.getGenreMatchScore(
            anime,
            settings.preferredGenres,
          );
          const durationScore = this.getDurationMatchScore(
            anime,
            settings.preferredDurations,
          );

          // El primer anime del conjunto recibe 1 y el último se aproxima a 0.
          // Este valor solo sirve como desempate entre candidatos similares.
          const popularityPrior =
            topPoolSize > 1 ? 1 - index / (topPoolSize - 1) : 1;

          const finalScore =
            genreScore * this.COLD_START_GENRE_WEIGHT +
            durationScore * this.COLD_START_DURATION_WEIGHT +
            popularityPrior * this.COLD_START_POPULARITY_WEIGHT;

          return { anime, finalScore };
        })
        .sort((a, b) => b.finalScore - a.finalScore)
        .slice(0, this.TARGET_RECOMMENDATIONS)
        .map((item) => item.anime);

      if (reranked.length === 0) {
        this.logger.warn(
          "El inicio en frío no produjo resultados; se usará el respaldo general.",
        );

        return this.getTopFallback(requestId, "empty_cold_start");
      }

      return {
        data: reranked,
        meta: {
          algorithm: "hybrid_cosine_preferences",
          strategy: "cold_start",
          count: reranked.length,
        } satisfies RecommendationMeta,
      };
    } catch (error) {
      this.logger.warn(
        `Falló la generación del conjunto de inicio en frío: ${this.getErrorMessage(
          error,
        )}. Se usará el respaldo general.`,
      );

      return this.getTopFallback(requestId, "cold_start_upstream_failure");
    }
  }

  // Cuenta cuántos géneros del anime coinciden con los seleccionados por el
  // usuario. Los identificadores se convierten a número para comparar ambos
  // conjuntos con el mismo tipo de dato.
  private countGenreMatches(anime: AnimeDto, preferredGenres: number[]) {
    if (!preferredGenres.length) return 0;

    const animeGenreIds = new Set(
      anime.genres.map((genre) => Number(genre.id)),
    );

    return preferredGenres.filter((genreId) => animeGenreIds.has(genreId))
      .length;
  }

  // Devuelve una puntuación entre 0 y 1 según la proporción de preferencias
  // de género del usuario que están presentes en el anime candidato.
  private getGenreMatchScore(anime: AnimeDto, preferredGenres: number[]) {
    if (!preferredGenres.length) return 0;

    const matches = this.countGenreMatches(anime, preferredGenres);
    return matches / preferredGenres.length;
  }

  // La coincidencia de duración es binaria: 1 cuando el tipo de duración del
  // anime coincide con alguna opción elegida por el usuario y 0 en otro caso.
  private getDurationMatchScore(anime: AnimeDto, preferredDurations: string[]) {
    if (!preferredDurations.length) return 0;

    const preferredSet = new Set(
      preferredDurations.map((duration) => duration.toUpperCase()),
    );

    return preferredSet.has(anime.durationType.toUpperCase()) ? 1 : 0;
  }

  // Si no existe señal suficiente o falla alguna etapa, se muestran títulos
  // populares. AnimeService se encarga internamente de proveedores, caché
  // persistente y catálogo de emergencia, por lo que la app no queda vacía.
  private async getTopFallback(requestId?: string, reason = "no_signal") {
    this.logger.warn(
      `Se usará la estrategia de respaldo por popularidad (motivo=${reason}).`,
    );

    const top = await this.animeService.getTop(
      this.TARGET_RECOMMENDATIONS,
      requestId,
    );

    return {
      data: top.data,
      meta: {
        algorithm: "hybrid_cosine_preferences",
        strategy: "fallback",
        count: top.data.length,
      } satisfies RecommendationMeta,
    };
  }

  // Normaliza las puntuaciones colaborativas al intervalo [0, 1].
  // Si todos los candidatos tienen el mismo valor, se asigna 1 a cada uno.
  private minMaxNormalize(scores: Map<number, number>) {
    const values = Array.from(scores.values());
    if (values.length === 0) return new Map<number, number>();

    const min = Math.min(...values);
    const max = Math.max(...values);
    const normalized = new Map<number, number>();

    for (const [animeId, score] of scores.entries()) {
      if (max === min) {
        normalized.set(animeId, 1);
        continue;
      }

      normalized.set(animeId, (score - min) / (max - min));
    }

    return normalized;
  }

  // Recupera los detalles de varios candidatos en una sola operación para
  // evitar una solicitud externa independiente por cada recomendación.
  private async fetchAnimeDetails(
    animeIds: number[],
    requestId?: string,
  ): Promise<AnimeDto[]> {
    if (!animeIds.length) {
      return [];
    }

    const candidateIds = animeIds.slice(0, this.MAX_DETAIL_CANDIDATES);

    try {
      return await this.animeService.getManyByIds(
        candidateIds,
        requestId,
        false,
      );
    } catch (error) {
      this.logger.warn(
        `No se pudo completar el lote de candidatos: ${this.getErrorMessage(
          error,
        )}`,
      );

      return [];
    }
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}