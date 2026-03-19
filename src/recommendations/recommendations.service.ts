import { Injectable, Logger } from "@nestjs/common";
import { InteractionType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AnimeDto, DurationType } from "../anime/dto/anime.dto";
import { AnimeService } from "../anime/anime.service";
import { calculateCosineSimilarity } from "./algorithms/cosine-similarity.util";

type UserSettingsSnapshot = {
  ageRange: number;
  genderCode: number;
  regionCode: number;
  preferredGenres: number[];
  preferredDurations: string[];
};

type RecommendationMeta = {
  algorithm: "hybrid_cosine_preferences";
  strategy: "collaborative" | "hybrid" | "cold_start" | "fallback";
  count: number;
};

@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);

  private readonly WEIGHTS: Record<InteractionType, number> = {
    FAVORITE: 5,
    VIEW: 1,
    TRIVIA_SCORE: 0,
    DISLIKE: -3,
    UNFAVORITE: -2,
  };

  private readonly MIN_GLOBAL_INTERACTIONS = 5;
  private readonly MIN_USER_INTERACTIONS_FOR_COLLAB = 3;

  // Hybrid weights: collaborative remains dominant when user has enough history.
  private readonly HYBRID_CF_WEIGHT = 0.75;
  private readonly HYBRID_GENRE_WEIGHT = 0.17;
  private readonly HYBRID_DURATION_WEIGHT = 0.06;
  private readonly HYBRID_DEMOGRAPHIC_WEIGHT = 0.02;

  // Cold start weights: preferences are primary, demographics are only tiebreaker.
  private readonly COLD_START_GENRE_WEIGHT = 0.65;
  private readonly COLD_START_DURATION_WEIGHT = 0.25;
  private readonly COLD_START_DEMOGRAPHIC_WEIGHT = 0.1;

  constructor(
    private readonly prisma: PrismaService,
    private readonly animeService: AnimeService,
  ) {}

  async getAdaptiveRecommendations(userId: string, requestId?: string) {
    const [allInteractions, settingsRaw] = await Promise.all([
      this.prisma.userInteraction.findMany(),
      this.prisma.userSettings.findUnique({
        where: { userId },
        select: {
          ageRange: true,
          genderCode: true,
          regionCode: true,
          preferredGenres: true,
          preferredDurations: true,
        },
      }),
    ]);

    const settings: UserSettingsSnapshot = {
      ageRange: settingsRaw?.ageRange ?? 0,
      genderCode: settingsRaw?.genderCode ?? 0,
      regionCode: settingsRaw?.regionCode ?? 0,
      preferredGenres: settingsRaw?.preferredGenres ?? [],
      preferredDurations: settingsRaw?.preferredDurations ?? [],
    };

    const userVectors = this.buildUserVectors(allInteractions);
    const currentUserVector = userVectors.get(userId);
    const userInteractionCount = currentUserVector?.size ?? 0;

    const hasPreferences =
      settings.preferredGenres.length > 0 ||
      settings.preferredDurations.length > 0;
    const hasDemographicSignals =
      settings.ageRange > 0 ||
      settings.genderCode > 0 ||
      settings.regionCode > 0;

    const hasEnoughCollaborativeSignal =
      allInteractions.length >= this.MIN_GLOBAL_INTERACTIONS &&
      userInteractionCount >= this.MIN_USER_INTERACTIONS_FOR_COLLAB;

    if (!hasEnoughCollaborativeSignal) {
      return this.getColdStartRecommendations(
        settings,
        requestId,
        hasPreferences || hasDemographicSignals,
      );
    }

    const collaborativeScores = this.calculateCollaborativeScores(
      userId,
      userVectors,
    );

    if (collaborativeScores.size === 0) {
      this.logger.log(
        `No collaborative candidates for user ${userId}, switching to cold start`,
      );
      return this.getColdStartRecommendations(
        settings,
        requestId,
        hasPreferences || hasDemographicSignals,
      );
    }

    const sortedCollaborative = Array.from(collaborativeScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40);

    const animeDetails = await this.fetchAnimeDetails(
      sortedCollaborative.map(([animeId]) => animeId),
      requestId,
    );

    if (animeDetails.length === 0) {
      this.logger.warn(
        `Collaborative/hybrid candidate details were empty for user ${userId}, switching to fallback`,
      );
      return this.getTopFallback(requestId, 'empty_hybrid_details');
    }

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
        const demographicScore = this.getDemographicScore(anime, settings);

        const finalScore =
          collaborativeScore * this.HYBRID_CF_WEIGHT +
          genreScore * this.HYBRID_GENRE_WEIGHT +
          durationScore * this.HYBRID_DURATION_WEIGHT +
          demographicScore * this.HYBRID_DEMOGRAPHIC_WEIGHT;

        return { anime, finalScore };
      })
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, 10)
      .map((item) => item.anime);

    const strategy: RecommendationMeta["strategy"] =
      hasPreferences || hasDemographicSignals ? "hybrid" : "collaborative";

    if (reranked.length === 0) {
      this.logger.warn(
        `Collaborative/hybrid scoring produced no results for user ${userId}, switching to fallback`,
      );
      return this.getTopFallback(requestId, 'empty_hybrid_scores');
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

  private buildUserVectors(
    allInteractions: Array<{
      userId: string;
      animeId: number;
      type: InteractionType;
      payload: unknown;
    }>,
  ) {
    const userVectors = new Map<string, Map<number, number>>();

    for (const record of allInteractions) {
      if (!userVectors.has(record.userId)) {
        userVectors.set(record.userId, new Map<number, number>());
      }

      const animeScores = userVectors.get(record.userId)!;
      let scoreToAdd = this.WEIGHTS[record.type];

      if (
        record.type === "TRIVIA_SCORE" &&
        record.payload &&
        typeof record.payload === "object"
      ) {
        const payloadData = record.payload as { score?: number };
        scoreToAdd =
          payloadData.score !== undefined ? payloadData.score / 2 : 2;
      }

      const currentScore = animeScores.get(record.animeId) || 0;
      animeScores.set(record.animeId, currentScore + scoreToAdd);
    }

    return userVectors;
  }

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

    const topNeighbors = Array.from(userSimilarities.entries())
      .filter(([, similarity]) => similarity > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);

    const scoreSums = new Map<number, number>();
    const absSimilaritySums = new Map<number, number>();

    for (const [otherUserId, similarity] of topNeighbors) {
      const otherUserVector = userVectors.get(otherUserId);
      if (!otherUserVector) continue;

      for (const [animeId, score] of otherUserVector.entries()) {
        if (currentUserVector.has(animeId)) continue;

        scoreSums.set(
          animeId,
          (scoreSums.get(animeId) || 0) + similarity * score,
        );
        absSimilaritySums.set(
          animeId,
          (absSimilaritySums.get(animeId) || 0) + Math.abs(similarity),
        );
      }
    }

    const predictedScores = new Map<number, number>();
    for (const [animeId, scoreSum] of scoreSums.entries()) {
      const similarityTotal = absSimilaritySums.get(animeId) || 0;
      if (similarityTotal === 0) continue;
      predictedScores.set(animeId, scoreSum / similarityTotal);
    }

    return predictedScores;
  }

  private async getColdStartRecommendations(
    settings: UserSettingsSnapshot,
    requestId: string | undefined,
    hasAnySignal: boolean,
  ) {
    if (!hasAnySignal) {
      return this.getTopFallback(requestId, "no_personalization_signal");
    }

    const topPool = await this.animeService.getTop(40, requestId);
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
        const demographicScore = this.getDemographicScore(anime, settings);
        const popularityPrior =
          topPoolSize > 1 ? 1 - index / (topPoolSize - 1) : 1;

        const finalScore =
          genreScore * this.COLD_START_GENRE_WEIGHT +
          durationScore * this.COLD_START_DURATION_WEIGHT +
          demographicScore * this.COLD_START_DEMOGRAPHIC_WEIGHT +
          popularityPrior * 0.05;

        return { anime, finalScore };
      })
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, 10)
      .map((item) => item.anime);

    if (reranked.length === 0) {
      this.logger.warn('Cold-start reranking produced no results, switching to fallback');
      return this.getTopFallback(requestId, 'empty_cold_start');
    }

    return {
      data: reranked,
      meta: {
        algorithm: "hybrid_cosine_preferences",
        strategy: "cold_start",
        count: reranked.length,
      } satisfies RecommendationMeta,
    };
  }

  private async getTopFallback(requestId?: string, reason = 'no_signal') {
    this.logger.warn(
      `Using top-anime fallback strategy (reason=${reason})`,
    );
    const top = await this.animeService.getTop(10, requestId);

    return {
      data: top.data,
      meta: {
        algorithm: "hybrid_cosine_preferences",
        strategy: "fallback",
        count: top.data.length,
      } satisfies RecommendationMeta,
    };
  }

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

  private getGenreMatchScore(anime: AnimeDto, preferredGenres: number[]) {
    if (!preferredGenres.length) return 0;

    const animeGenreIds = new Set(
      anime.genres.map((genre) => Number(genre.id)),
    );
    const matches = preferredGenres.filter((genreId) =>
      animeGenreIds.has(genreId),
    ).length;

    return matches / preferredGenres.length;
  }

  private getDurationMatchScore(anime: AnimeDto, preferredDurations: string[]) {
    if (!preferredDurations.length) return 0;

    const preferredSet = new Set(
      preferredDurations.map((duration) => duration.toUpperCase()),
    );
    return preferredSet.has(anime.durationType.toUpperCase()) ? 1 : 0;
  }

  private getDemographicScore(anime: AnimeDto, settings: UserSettingsSnapshot) {
    const ageScore = this.getAgeRangeAffinity(anime, settings.ageRange);
    const genderScore = this.getGenderAffinity(anime, settings.genderCode);
    const regionScore = this.getRegionAffinity(anime, settings.regionCode);

    return (ageScore + genderScore + regionScore) / 3;
  }

  private getAgeRangeAffinity(anime: AnimeDto, ageRange: number) {
    if (ageRange <= 0) return 0;

    const releaseYear = anime.releaseYear ?? 0;

    if (ageRange <= 2) {
      return releaseYear >= 2015 || anime.durationType === DurationType.SHORT
        ? 1
        : 0.2;
    }

    if (ageRange <= 4) {
      return anime.durationType === DurationType.MEDIUM ? 1 : 0.5;
    }

    return releaseYear > 0 && releaseYear <= 2012 ? 1 : 0.4;
  }

  private getGenderAffinity(anime: AnimeDto, genderCode: number) {
    if (genderCode <= 0) return 0;

    const genreIds = new Set(anime.genres.map((genre) => Number(genre.id)));
    const masculineLeanGenres = [1, 2, 7, 27, 30];
    const feminineLeanGenres = [8, 22, 36, 41, 50];

    if (genderCode === 1) {
      return masculineLeanGenres.some((genreId) => genreIds.has(genreId))
        ? 1
        : 0.4;
    }

    if (genderCode === 2) {
      return feminineLeanGenres.some((genreId) => genreIds.has(genreId))
        ? 1
        : 0.4;
    }

    return 0.5;
  }

  private getRegionAffinity(anime: AnimeDto, regionCode: number) {
    if (regionCode <= 0) return 0;

    const genreIds = new Set(anime.genres.map((genre) => Number(genre.id)));
    const latinTrendGenres = [1, 4, 10, 24];
    const asianTrendGenres = [8, 14, 37, 41];

    if (regionCode <= 2) {
      return latinTrendGenres.some((genreId) => genreIds.has(genreId))
        ? 1
        : 0.4;
    }

    if (regionCode <= 4) {
      return asianTrendGenres.some((genreId) => genreIds.has(genreId))
        ? 1
        : 0.4;
    }

    return 0.5;
  }

  private async fetchAnimeDetails(
    animeIds: number[],
    requestId?: string,
  ): Promise<AnimeDto[]> {
    if (!animeIds.length) return [];

    const details = await Promise.allSettled(
      animeIds.map((animeId) => this.animeService.getById(animeId, requestId)),
    );

    const animeList: AnimeDto[] = [];
    for (const result of details) {
      if (result.status === "fulfilled") {
        animeList.push(result.value.data);
      }
    }

    return animeList;
  }
}
