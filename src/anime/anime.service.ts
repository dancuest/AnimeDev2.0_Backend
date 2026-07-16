import { HttpService } from '@nestjs/axios';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cache } from 'cache-manager';
import { lastValueFrom } from 'rxjs';

import { AnimeMapper } from './anime.mapper';
import {
  AnimeDetailDto,
  AnimeRelationType,
  RelatedAnimeDto,
} from './dto/anime-detail.dto';
import { AnimeDto, GenreDto } from './dto/anime.dto';
import {
  JikanAnime,
  JikanDetailResponse,
  JikanListResponse,
} from './types/jikan.types';

interface MyMemoryTranslationResponse {
  responseData?: {
    translatedText?: string;
    match?: number;
  };
  responseStatus?: number | string;
  responseDetails?: string;
  quotaFinished?: boolean;
  responderId?: string;
}

type GoogleTranslateResponse = [
  Array<[string, string, unknown, unknown]>,
  unknown,
  string,
];

@Injectable()
export class AnimeService {
  private readonly logger = new Logger(AnimeService.name);

  private readonly baseUrl: string;
  private readonly cacheTtlMs: number;
  private readonly shortCacheTtlMs: number;
  private readonly translateSynopses: boolean;
  private readonly translationBaseUrl: string;
  private readonly translationEmail?: string;

  private static readonly ADULT_GENRE_IDS = new Set(['9', '12', '49']);

  /**
   * MyMemory limita q a 500 bytes UTF-8.
   * Se usa 380 para dejar margen operativo y evitar rechazos silenciosos.
   */
  private static readonly TRANSLATION_CHUNK_MAX_BYTES = 380;

  private static readonly MYMEMORY_TIMEOUT_MS = 12_000;
  private static readonly GOOGLE_TRANSLATE_TIMEOUT_MS = 15_000;

  private static readonly GOOGLE_TRANSLATE_URL =
    'https://translate.googleapis.com/translate_a/single';

  /**
   * Jikan permite 3 solicitudes por segundo y 60 por minuto.
   * Se usa un margen de seguridad para evitar nuevas respuestas 429.
   */
  private static readonly JIKAN_MIN_INTERVAL_MS = 400;
  private static readonly JIKAN_WINDOW_MS = 60_000;
  private static readonly JIKAN_MAX_REQUESTS_PER_WINDOW = 60;
  private static readonly JIKAN_MAX_ATTEMPTS = 3;
  private static readonly JIKAN_TIMEOUT_MS = 15_000;

  /**
   * Cola global del servicio para serializar las llamadas a Jikan.
   * AnimeService es singleton dentro de NestJS, por lo que protege todos
   * los endpoints que consumen el proveedor externo.
   */
  private jikanQueue: Promise<void> = Promise.resolve();
  private readonly jikanRequestTimestamps: number[] = [];

  /**
   * Evita que varias solicitudes simultáneas consulten el mismo recurso
   * cuando todavía no se ha guardado en caché.
   */
  private readonly inFlightRequests = new Map<string, Promise<unknown>>();

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly mapper: AnimeMapper,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {
    this.baseUrl =
      this.configService.get<string>('jikanBaseUrl') ??
      'https://api.jikan.moe/v4';

    this.cacheTtlMs =
      this.configService.get<number>('cacheTtlMs') ?? 600_000;

    this.shortCacheTtlMs =
      this.configService.get<number>('shortCacheTtlMs') ?? 60_000;

    this.translateSynopses =
      this.configService.get<boolean>('translateSynopses') ?? true;

    this.translationBaseUrl =
      this.configService.get<string>('translationBaseUrl') ??
      'https://api.mymemory.translated.net/get';

    this.translationEmail =
      this.configService.get<string>('translationEmail') || undefined;

    this.logger.log(
      `AnimeService iniciado. translateSynopses=${this.translateSynopses}, translationEmail=${this.translationEmail ? 'configurado' : 'no configurado'
      }`,
    );
  }

  /**
   * Si includeAdult !== true, se fuerza sfw=true hacia Jikan.
   */
  private withSfw(
    params: Record<string, unknown>,
    includeAdult?: boolean,
  ): Record<string, unknown> {
    if (includeAdult === true) {
      return params;
    }

    return {
      ...params,
      sfw: true,
    };
  }

  async getTop(limit = 10, requestId?: string, includeAdult?: boolean) {
    const cacheKey = `anime:top:${limit}:${includeAdult === true ? 'all' : 'sfw'
      }`;

    const data = await this.getCached(
      cacheKey,
      async () => {
        const response = await this.fetchList<JikanAnime>(
          '/top/anime',
          this.withSfw({ limit }, includeAdult),
          requestId,
        );

        return response.data.map((anime) => this.mapper.toAnimeDto(anime));
      },
      this.shortCacheTtlMs,
    );

    return {
      data,
      meta: { limit },
    };
  }

  async search(
    query: string,
    limit = 10,
    requestId?: string,
    includeAdult?: boolean,
  ) {
    const normalizedQuery = query.trim().toLowerCase();

    const cacheKey = `anime:search:${normalizedQuery}:${limit}:${includeAdult === true ? 'all' : 'sfw'
      }`;

    return this.getCached(
      cacheKey,
      async () => {
        const response = await this.fetchList<JikanAnime>(
          '/anime',
          this.withSfw({ q: query, limit }, includeAdult),
          requestId,
        );

        return {
          data: response.data.map((anime) => this.mapper.toAnimeDto(anime)),
          meta: {
            limit,
            total: response.pagination?.items?.total ?? response.data.length,
            count: response.pagination?.items?.count ?? response.data.length,
            hasNextPage: response.pagination?.has_next_page ?? false,
          },
        };
      },
      this.shortCacheTtlMs,
    );
  }

  async getById(
    id: number,
    requestId?: string,
    translateSynopsis = true,
  ): Promise<{ data: AnimeDto }> {
    /**
     * Las tarjetas internas del recomendador y la restauración de favoritos
     * pueden solicitar translateSynopsis=false para evitar traducciones masivas.
     * El detalle completo mantiene la traducción al español.
     */
    const cacheKey = translateSynopsis
      ? `anime:${id}:es:v22`
      : `anime:${id}:raw:v1`;

    const anime = await this.getCached(cacheKey, async () => {
      const response = await this.fetchDetail<JikanAnime>(
        `/anime/${id}`,
        requestId,
      );

      const mappedAnime = this.mapper.toAnimeDto(response.data);

      return translateSynopsis
        ? this.withSpanishSynopsis(mappedAnime)
        : mappedAnime;
    });

    return {
      data: anime,
    };
  }

  async getDetail(
    id: number,
    requestId?: string,
  ): Promise<{ data: AnimeDetailDto }> {

    const cacheKey = `anime:detail:${id}:full:es:v22`;

    const detail = await this.getCached(cacheKey, async () => {
      const response = await this.fetchDetail<JikanAnime>(
        `/anime/${id}/full`,
        requestId,
      );

      const anime = this.mapper.toAnimeDto(response.data);
      const animeWithSpanishSynopsis = await this.withSpanishSynopsis(anime);

      return {
        anime: animeWithSpanishSynopsis,
        culturalNotes: this.buildCulturalNotes(
          animeWithSpanishSynopsis,
          response.data,
        ),
        trailers: [],
        relatedAnime: this.buildRelatedAnime(response.data),
      };
    });

    return { data: detail };
  }

  async getHero(requestId?: string): Promise<{ data: AnimeDto }> {
    const cacheKey = 'anime:hero:es:v21';

    const anime = await this.getCached(
      cacheKey,
      async () => {
        const response = await this.fetchList<JikanAnime>(
          '/top/anime',
          this.withSfw({ limit: 10 }, false),
          requestId,
        );

        const items = response.data.map((item) =>
          this.mapper.toAnimeDto(item),
        );

        if (items.length === 0) {
          throw new HttpException(
            {
              statusCode: HttpStatus.SERVICE_UNAVAILABLE,
              message: 'No hero anime available from upstream provider',
              upstream: 'jikan',
              requestId: requestId ?? null,
            },
            HttpStatus.SERVICE_UNAVAILABLE,
          );
        }

        const selectedAnime = items[Math.floor(Math.random() * items.length)];

        return this.withSpanishSynopsis(selectedAnime);
      },
      this.shortCacheTtlMs,
    );

    return { data: anime };
  }

  async getByGenre(
    genreId: string,
    limit = 10,
    requestId?: string,
    includeAdult?: boolean,
  ): Promise<{ data: AnimeDto[]; meta: { limit: number } }> {
    const cacheKey = `anime:genre:${genreId}:${limit}:${includeAdult === true ? 'all' : 'sfw'
      }`;

    const data = await this.getCached(
      cacheKey,
      async () => {
        const response = await this.fetchList<JikanAnime>(
          '/anime',
          this.withSfw({ genres: genreId, limit }, includeAdult),
          requestId,
        );

        return response.data.map((anime) => this.mapper.toAnimeDto(anime));
      },
      this.shortCacheTtlMs,
    );

    return {
      data,
      meta: { limit },
    };
  }

  async getGenres(
    includeAdult = true,
    requestId?: string,
  ): Promise<{ data: GenreDto[] }> {
    const cacheKey = `anime:genres:${includeAdult ? 'all' : 'safe'}`;

    const genres = await this.getCached(
      cacheKey,
      async () => {
        const response = await this.fetchList<{
          mal_id: number;
          name: string;
        }>('/genres/anime', {}, requestId);

        const mappedGenres = response.data.map((genre) =>
          this.mapper.toGenreDto(genre),
        );

        if (includeAdult) {
          return mappedGenres;
        }

        return mappedGenres.filter(
          (genre) => !AnimeService.ADULT_GENRE_IDS.has(genre.id),
        );
      },
      this.shortCacheTtlMs,
    );

    return {
      data: genres,
    };
  }

  private async fetchList<T>(
    endpoint: string,
    params: Record<string, unknown>,
    requestId?: string,
  ): Promise<JikanListResponse<T>> {
    return this.executeJikanRequest(
      async () => {
        const response = await lastValueFrom(
          this.httpService.get<JikanListResponse<T>>(
            `${this.baseUrl}${endpoint}`,
            {
              params,
              timeout: AnimeService.JIKAN_TIMEOUT_MS,
            },
          ),
        );

        return response.data;
      },
      requestId,
      endpoint,
    );
  }

  private async fetchDetail<T>(
    endpoint: string,
    requestId?: string,
  ): Promise<JikanDetailResponse<T>> {
    return this.executeJikanRequest(
      async () => {
        const response = await lastValueFrom(
          this.httpService.get<JikanDetailResponse<T>>(
            `${this.baseUrl}${endpoint}`,
            {
              timeout: AnimeService.JIKAN_TIMEOUT_MS,
            },
          ),
        );

        return response.data;
      },
      requestId,
      endpoint,
    );
  }

  private async getCached<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs = this.cacheTtlMs,
  ): Promise<T> {
    const cached = await this.cacheManager.get<T>(key);

    if (cached !== undefined && cached !== null) {
      return cached;
    }

    const existingRequest = this.inFlightRequests.get(key) as
      | Promise<T>
      | undefined;

    if (existingRequest) {
      return existingRequest;
    }

    const request = (async () => {
      const fresh = await fetcher();
      await this.cacheManager.set(key, fresh, ttlMs);
      return fresh;
    })();

    this.inFlightRequests.set(key, request);

    try {
      return await request;
    } finally {
      if (this.inFlightRequests.get(key) === request) {
        this.inFlightRequests.delete(key);
      }
    }
  }

  private enqueueJikanRequest<T>(request: () => Promise<T>): Promise<T> {
    const task = this.jikanQueue.then(async () => {
      await this.waitForJikanSlot();
      return request();
    });

    /**
     * La cola debe seguir avanzando aunque una solicitud individual falle.
     */
    this.jikanQueue = task.then(
      () => undefined,
      () => undefined,
    );

    return task;
  }

  private async waitForJikanSlot(): Promise<void> {
    while (true) {
      const now = Date.now();
      const windowStart = now - AnimeService.JIKAN_WINDOW_MS;

      while (
        this.jikanRequestTimestamps.length > 0 &&
        this.jikanRequestTimestamps[0] <= windowStart
      ) {
        this.jikanRequestTimestamps.shift();
      }

      const lastRequestAt =
        this.jikanRequestTimestamps[
          this.jikanRequestTimestamps.length - 1
        ] ?? 0;

      const perSecondWait = Math.max(
        0,
        lastRequestAt + AnimeService.JIKAN_MIN_INTERVAL_MS - now,
      );

      const perMinuteWait =
        this.jikanRequestTimestamps.length >=
        AnimeService.JIKAN_MAX_REQUESTS_PER_WINDOW
          ? Math.max(
              0,
              this.jikanRequestTimestamps[0] +
                AnimeService.JIKAN_WINDOW_MS -
                now,
            )
          : 0;

      const waitMs = Math.max(perSecondWait, perMinuteWait);

      if (waitMs <= 0) {
        this.jikanRequestTimestamps.push(Date.now());
        return;
      }

      await this.sleep(waitMs);
    }
  }

  private async executeJikanRequest<T>(
    request: () => Promise<T>,
    requestId: string | undefined,
    endpoint: string,
  ): Promise<T> {
    let lastError: unknown;

    for (
      let attempt = 1;
      attempt <= AnimeService.JIKAN_MAX_ATTEMPTS;
      attempt += 1
    ) {
      try {
        return await this.enqueueJikanRequest(request);
      } catch (error) {
        lastError = error;

        const upstreamStatus = this.getUpstreamStatus(error);
        const retryable =
          upstreamStatus === undefined ||
          upstreamStatus === HttpStatus.TOO_MANY_REQUESTS ||
          upstreamStatus >= HttpStatus.INTERNAL_SERVER_ERROR;

        if (!retryable || attempt === AnimeService.JIKAN_MAX_ATTEMPTS) {
          break;
        }

        const retryDelayMs = this.getRetryDelayMs(error, attempt);

        this.logger.warn(
          `Jikan falló en ${endpoint}. status=${upstreamStatus ?? 'network'} ` +
            `attempt=${attempt}/${AnimeService.JIKAN_MAX_ATTEMPTS}. ` +
            `Reintentando en ${retryDelayMs}ms`,
        );

        await this.sleep(retryDelayMs);
      }
    }

    throw this.buildUpstreamError(lastError, requestId, endpoint);
  }

  private getUpstreamStatus(error: unknown): number | undefined {
    return (error as { response?: { status?: number } })?.response?.status;
  }

  private getRetryDelayMs(error: unknown, attempt: number): number {
    const retryAfter = (
      error as {
        response?: {
          headers?: Record<string, string | number | undefined>;
        };
      }
    )?.response?.headers?.['retry-after'];

    if (retryAfter !== undefined) {
      const retryAfterValue = String(retryAfter).trim();
      const seconds = Number(retryAfterValue);

      if (Number.isFinite(seconds) && seconds >= 0) {
        return Math.max(1_000, Math.ceil(seconds * 1_000));
      }

      const retryDate = Date.parse(retryAfterValue);

      if (!Number.isNaN(retryDate)) {
        return Math.max(1_000, retryDate - Date.now());
      }
    }

    return 1_000 * attempt;
  }

  private sleep(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  private buildUpstreamError(
    error: unknown,
    requestId: string | undefined,
    endpoint: string,
  ) {
    const axiosError = error as {
      response?: {
        status?: number;
        data?: {
          message?: string;
          error?: string;
        };
      };
      message?: string;
      code?: string;
    };

    const upstreamStatus = axiosError.response?.status;

    const statusCode =
      upstreamStatus === HttpStatus.TOO_MANY_REQUESTS ||
      (upstreamStatus !== undefined &&
        upstreamStatus >= HttpStatus.INTERNAL_SERVER_ERROR)
        ? HttpStatus.SERVICE_UNAVAILABLE
        : HttpStatus.BAD_GATEWAY;

    const upstreamMessage =
      axiosError.response?.data?.message ?? axiosError.response?.data?.error;

    const fallbackMessage = `Jikan upstream request failed at ${endpoint}`;

    return new HttpException(
      {
        error: {
          code: 'UPSTREAM_FAILURE',
          message: upstreamMessage ?? axiosError.message ?? fallbackMessage,
          upstream: 'jikan',
          upstreamStatus: upstreamStatus ?? null,
          endpoint,
          requestId: requestId ?? null,
        },
      },
      statusCode,
    );
  }

  private buildCulturalNotes(anime: AnimeDto, source: JikanAnime): string[] {
    const notes: string[] = [];

    const seasonName = this.translateSeason(source.season);
    const sourceName = this.translateAnimeSource(source.source);
    const setting = this.detectCulturalSetting(anime, source);
    const themeNames = this.getResourceNames(source.themes);
    const demographicNames = this.getResourceNames(source.demographics);
    const studioNames = this.getResourceNames(source.studios).slice(0, 2);
    const glossaryTerms = this.buildCulturalGlossary(anime, source);

    if (seasonName && anime.releaseYear) {
      notes.push(
        `Temporada original: ${seasonName} de ${anime.releaseYear}. En Japón, muchas series de anime se estrenan por temporadas televisivas: invierno, primavera, verano y otoño. Este dato ayuda a ubicar la obra dentro del calendario real de emisión japonés.`,
      );
    } else if (anime.releaseYear) {
      notes.push(
        `Contexto de estreno: la obra fue estrenada en ${anime.releaseYear}. Este dato permite relacionarla con las tendencias narrativas, visuales y comerciales del anime de su época.`,
      );
    }

    if (source.aired?.string) {
      notes.push(
        `Periodo de emisión: ${source.aired.string}. Esta información muestra durante qué etapa fue transmitida originalmente la obra y ayuda a diferenciar animes de emisión semanal, temporadas cortas o producciones de larga duración.`,
      );
    }

    if (sourceName) {
      notes.push(
        `Origen de la obra: ${sourceName}. Conocer la fuente original permite entender si el anime adapta un manga, una novela ligera, un videojuego o si fue creado directamente como animación original.`,
      );
    }

    if (setting) {
      notes.push(setting);
    }

    glossaryTerms.forEach((entry) => {
      notes.push(
        `Glosario cultural — ${entry.term}: ${entry.meaning} ${entry.context}`,
      );
    });

    if (anime.genres.length > 0) {
      const genreNames = anime.genres
        .slice(0, 4)
        .map((genre) => genre.name)
        .join(', ');

      notes.push(
        `Lectura cultural de los géneros: esta obra combina elementos de ${genreNames}. Estos géneros no solo clasifican la historia, también orientan expectativas sobre valores narrativos como aventura, amistad, conflicto, superación, humor, romance o crítica social.`,
      );
    }

    if (themeNames.length > 0) {
      notes.push(
        `Temas narrativos relevantes: ${themeNames.slice(0, 4).join(', ')}. Estos temas ayudan a interpretar el contexto de la historia, sus conflictos principales y las referencias culturales que pueden aparecer durante la obra.`,
      );
    }

    if (demographicNames.length > 0) {
      notes.push(
        `Demografía editorial: ${demographicNames.slice(0, 3).join(', ')}. En el anime y el manga, etiquetas como shōnen, seinen, shōjo o josei no describen únicamente edad, sino también tradiciones editoriales, tono narrativo y tipo de conflictos frecuentes.`,
      );
    }

    if (studioNames.length > 0) {
      notes.push(
        `Producción visual: ${studioNames.join(', ')} ${studioNames.length === 1 ? 'participó' : 'participaron'} en la animación. Reconocer el estudio ayuda a identificar estilos visuales, ritmo narrativo y formas de representar mundos cotidianos o fantásticos.`,
      );
    }

    if (notes.length === 0) {
      notes.push(
        'Ficha cultural en construcción: por ahora no hay suficientes datos externos para generar un contexto cultural amplio de esta obra.',
      );
    }

    return notes.slice(0, 10);
  }

  private buildRelatedAnime(source: JikanAnime): RelatedAnimeDto[] {
    const relations = source.relations ?? [];

    return relations
      .flatMap((relation) => {
        const relationType = this.toAnimeRelationType(relation.relation);

        if (!relationType) {
          return [];
        }

        const relationLabel = this.translateAnimeRelationType(relationType);

        return (relation.entry ?? [])
          .filter((entry) => entry.type?.toLowerCase() === 'anime')
          .map((entry) => ({
            id: Number(entry.mal_id),
            title: entry.name,
            relationType,
            relationLabel,
            url: entry.url ?? '',
            sourceType: entry.type ?? 'anime',
          }));
      })
      .filter((entry) => Number.isFinite(entry.id) && entry.title.trim().length > 0)
      .sort((left, right) => {
        const order: Record<AnimeRelationType, number> = {
          PREQUEL: 0,
          SEQUEL: 1,
        };

        return order[left.relationType] - order[right.relationType];
      })
      .slice(0, 8);
  }

  private toAnimeRelationType(
    relation?: string | null,
  ): AnimeRelationType | null {
    const normalized = relation?.toLowerCase().trim() ?? '';

    if (normalized.includes('prequel')) {
      return 'PREQUEL';
    }

    if (normalized.includes('sequel')) {
      return 'SEQUEL';
    }

    return null;
  }

  private translateAnimeRelationType(
    relationType: AnimeRelationType,
  ): string {
    const labels: Record<AnimeRelationType, string> = {
      PREQUEL: 'Precuela',
      SEQUEL: 'Secuela',
    };

    return labels[relationType];
  }

  private translateSeason(season?: string | null): string | null {
    if (!season) {
      return null;
    }

    const normalized = season.toLowerCase();

    const seasons: Record<string, string> = {
      winter: 'Invierno',
      spring: 'Primavera',
      summer: 'Verano',
      fall: 'Otoño',
    };

    return seasons[normalized] ?? season;
  }

  private translateAnimeSource(source?: string | null): string | null {
    if (!source) {
      return null;
    }

    const normalized = source.toLowerCase();

    const sources: Record<string, string> = {
      manga: 'Manga',
      'web manga': 'Manga web',
      novel: 'Novela',
      'light novel': 'Novela ligera',
      original: 'Obra original',
      game: 'Videojuego',
      'visual novel': 'Novela visual',
      '4-koma manga': 'Manga yonkoma de cuatro viñetas',
      book: 'Libro',
      card: 'Juego de cartas',
      music: 'Música',
      other: 'Otra fuente',
      unknown: 'Fuente no especificada',
    };

    return sources[normalized] ?? source;
  }

  private getResourceNames(
    resources?: Array<{ name?: string | null }> | null,
  ): string[] {
    return (resources ?? [])
      .map((resource) => resource.name?.trim())
      .filter((name): name is string => Boolean(name));
  }

  private detectCulturalSetting(
    anime: AnimeDto,
    source: JikanAnime,
  ): string | null {
    const searchableText = this.buildSearchableCulturalText(anime, source);

    const hasAny = (...terms: string[]) =>
      terms.some((term) => searchableText.includes(term));

    if (hasAny('samurai', 'historical', 'feudal', 'shogun', 'edo period')) {
      return 'Ambientación histórica o feudal: la obra contiene elementos asociados a épocas antiguas, clanes, samuráis, guerras tradicionales o estructuras sociales propias del Japón histórico. Este contexto permite analizar valores como honor, jerarquía, deber y conflicto entre tradición y cambio.';
    }

    if (hasAny('space', 'sci fi', 'science fiction', 'mecha', 'cyberpunk', 'robot')) {
      return 'Ambientación futurista o de ciencia ficción: la historia incorpora tecnología avanzada, robots, viajes espaciales o sociedades futuras. Este tipo de anime suele explorar temas como identidad, progreso, guerra, memoria, inteligencia artificial o desigualdad social.';
    }

    if (hasAny('school', 'club', 'student', 'academy', 'classroom')) {
      return 'Contexto escolar japonés: la obra se relaciona con espacios escolares, clubes estudiantiles o dinámicas de aula. En el anime, la escuela suele representar amistad, disciplina, crecimiento personal, presión académica y construcción de identidad.';
    }

    if (hasAny('military', 'war', 'army', 'soldier', 'battlefield')) {
      return 'Contexto militar o bélico: la obra incluye conflictos armados, jerarquías militares o escenarios de guerra. Este tipo de ambientación permite analizar poder, sacrificio, obediencia, trauma y consecuencias sociales del conflicto.';
    }

    if (hasAny('pirate', 'pirates', 'treasure', 'sea adventure')) {
      return 'Ambientación de aventura pirata: la historia se vincula con viajes marítimos, búsqueda de tesoros, tripulaciones y libertad. Este contexto suele trabajar temas como compañerismo, exploración, sueños personales y resistencia frente a sistemas de poder.';
    }

    if (hasAny('isekai', 'reincarnation', 'another world', 'fantasy world')) {
      return 'Ambientación fantástica o de mundo alternativo: la obra presenta viajes a otros mundos, reencarnación o universos con reglas distintas a la realidad cotidiana. Este recurso permite explorar segundas oportunidades, escape social, identidad y adaptación cultural.';
    }

    if (hasAny('workplace', 'office', 'company', 'job')) {
      return 'Contexto laboral: la obra se relaciona con espacios de trabajo, empresas u oficios. Este tipo de anime puede mostrar aspectos de la cultura laboral japonesa, responsabilidades adultas, jerarquías profesionales y equilibrio entre vida personal y trabajo.';
    }

    if (hasAny('otaku culture', 'anime fan', 'manga fan', 'cosplay', 'doujin')) {
      return 'Cultura otaku: la obra contiene referencias al consumo de anime, manga, videojuegos, cosplay o comunidades de fans. Este contexto ayuda a entender prácticas culturales contemporáneas de Japón y su expansión global.';
    }

    if (hasAny('organized crime', 'yakuza', 'mafia', 'gang')) {
      return 'Contexto de crimen organizado: la historia incluye organizaciones criminales, mafias o estructuras de poder clandestinas. En obras japonesas, este tipo de contexto puede vincularse con representaciones de la yakuza, códigos de lealtad y violencia social.';
    }

    if (hasAny('time travel', 'past', 'future timeline')) {
      return 'Ambientación con viajes temporales: la obra usa desplazamientos en el tiempo o líneas temporales alternativas. Este recurso permite comparar épocas, decisiones personales y consecuencias culturales o sociales de cambiar el pasado.';
    }

    return null;
  }

  private buildCulturalGlossary(
    anime: AnimeDto,
    source: JikanAnime,
  ): Array<{ term: string; meaning: string; context: string }> {
    const searchableText = this.buildSearchableCulturalText(anime, source);

    const glossary = [
      {
        term: 'Shōnen',
        triggers: ['shounen', 'shonen', 'shōnen'],
        meaning:
          'categoría editorial asociada tradicionalmente a público juvenil masculino.',
        context:
          'En el anime suele relacionarse con aventura, amistad, entrenamiento, rivalidades, superación personal y protagonistas que crecen enfrentando desafíos.',
      },
      {
        term: 'Shōjo',
        triggers: ['shoujo', 'shojo', 'shōjo'],
        meaning:
          'categoría editorial asociada tradicionalmente a público juvenil femenino.',
        context:
          'Suele enfocarse en emociones, vínculos personales, romance, identidad, madurez y conflictos afectivos o sociales.',
      },
      {
        term: 'Seinen',
        triggers: ['seinen'],
        meaning:
          'categoría editorial orientada generalmente a jóvenes adultos o público adulto.',
        context:
          'Suele trabajar conflictos más psicológicos, políticos, sociales o moralmente complejos, con un tono más maduro.',
      },
      {
        term: 'Josei',
        triggers: ['josei'],
        meaning:
          'categoría editorial dirigida principalmente a mujeres adultas.',
        context:
          'Suele abordar relaciones, vida laboral, independencia, madurez emocional y conflictos cotidianos desde una mirada adulta.',
      },
      {
        term: 'Isekai',
        triggers: ['isekai', 'isekay', 'another world', 'mundo alternativo', 'reencarnacion', 'reincarnation'],
        meaning:
          'subgénero donde el protagonista es transportado, invocado o reencarna en otro mundo.',
        context:
          'Culturalmente se relaciona con fantasías de escape, segundas oportunidades, reinicio de vida y adaptación a sociedades con reglas distintas.',
      },
      {
        term: 'Yuri / Girls Love',
        triggers: ['yuri', 'girls love', 'amor entre chicas', 'shoujo ai', 'shojo ai'],
        meaning:
          'género o etiqueta narrativa centrada en vínculos afectivos o románticos entre personajes femeninos.',
        context:
          'Puede ir desde relaciones sutiles y emocionales hasta historias románticas explícitas, dependiendo del tono de la obra.',
      },
      {
        term: 'Yaoi / Boys Love',
        triggers: ['yaoi', 'boys love', 'amor entre chicos', 'shounen ai', 'shonen ai'],
        meaning:
          'género o etiqueta narrativa centrada en vínculos afectivos o románticos entre personajes masculinos.',
        context:
          'En la cultura del manga y anime suele asociarse al mercado Boys Love, con historias románticas, dramáticas o emocionales.',
      },
      {
        term: 'Mecha',
        triggers: ['mecha', 'robot', 'robots', 'robot gigante', 'ciencia ficcion'],
        meaning:
          'subgénero centrado en robots gigantes, tecnología militar o máquinas pilotadas.',
        context:
          'Puede representar tensiones entre humanidad, guerra, tecnología, poder político e identidad personal.',
      },
      {
        term: 'Mahō shōjo',
        triggers: ['mahou shoujo', 'mahou shojo', 'magical girl', 'chica magica'],
        meaning:
          'subgénero de chicas mágicas donde personajes jóvenes adquieren poderes especiales.',
        context:
          'Suele combinar transformación, amistad, responsabilidad, identidad, fantasía y crecimiento personal.',
      },
      {
        term: 'Slice of Life',
        triggers: ['slice of life', 'recuentos de la vida', 'vida cotidiana'],
        meaning:
          'género centrado en experiencias cotidianas, relaciones simples y momentos de la vida diaria.',
        context:
          'Permite observar costumbres escolares, familiares, laborales o comunitarias desde una mirada tranquila y cercana.',
      },
      {
        term: 'Iyashikei',
        triggers: ['iyashikei'],
        meaning:
          'subgénero asociado a historias calmadas, contemplativas o reconfortantes.',
        context:
          'Busca generar una sensación de tranquilidad o sanación emocional mediante ambientes cotidianos, naturaleza o vínculos amables.',
      },
      {
        term: 'Ecchi',
        triggers: ['ecchi'],
        meaning:
          'etiqueta asociada a humor sugerente, fanservice o situaciones picantes sin llegar necesariamente al contenido adulto explícito.',
        context:
          'En el anime comercial suele usarse como recurso cómico o de atracción visual, aunque puede variar mucho según la obra.',
      },
      {
        term: 'Harén',
        triggers: ['harem', 'haren', 'harén'],
        meaning:
          'estructura narrativa donde un personaje central está rodeado de varios intereses románticos potenciales.',
        context:
          'Suele usarse en comedias románticas, fantasía o historias escolares para generar tensión afectiva, humor y competencia emocional.',
      },
      {
        term: 'Samurái',
        triggers: ['samurai', 'samurái', 'shogun', 'edo period', 'feudal', 'historico'],
        meaning:
          'figura guerrera del Japón histórico asociada al servicio, la disciplina y el honor.',
        context:
          'En el anime suele usarse para explorar tradición, jerarquía, lealtad y conflictos entre deber personal y normas sociales.',
      },
      {
        term: 'Yōkai',
        triggers: ['youkai', 'yokai', 'yōkai', 'spirit', 'spirits', 'demon', 'demons', 'espiritu', 'demonio'],
        meaning:
          'criaturas, espíritus o entidades sobrenaturales del folclore japonés.',
        context:
          'Permiten conectar la historia con creencias populares, relatos tradicionales, mitología japonesa y explicaciones fantásticas del mundo.',
      },
      {
        term: 'Matsuri',
        triggers: ['matsuri', 'festival', 'festivals'],
        meaning:
          'festival tradicional japonés, muchas veces asociado a templos, estaciones del año o celebraciones comunitarias.',
        context:
          'En el anime suele aparecer con comida típica, juegos, yukata, fuegos artificiales y escenas de convivencia social.',
      },
      {
        term: 'Otaku',
        triggers: ['otaku culture', 'otaku', 'cosplay', 'doujin', 'cultura otaku'],
        meaning:
          'persona con gran afición por anime, manga, videojuegos u otras formas de cultura popular japonesa.',
        context:
          'El término permite analizar comunidades fan, consumo cultural, identidad y circulación global del anime.',
      },
      {
        term: 'Yakuza',
        triggers: ['yakuza', 'organized crime', 'crimen organizado', 'mafia'],
        meaning:
          'organización criminal japonesa con códigos internos de jerarquía, lealtad y territorio.',
        context:
          'Cuando aparece en anime, suele representar poder clandestino, honor criminal, violencia y tensiones sociales.',
      },
    ];

    return glossary
      .filter((entry) =>
        entry.triggers.some((trigger) => searchableText.includes(trigger)),
      )
      .slice(0, 6)
      .map(({ term, meaning, context }) => ({
        term,
        meaning,
        context,
      }));
  }

  private buildSearchableCulturalText(
    anime: AnimeDto,
    source: JikanAnime,
  ): string {
    const values = [
      anime.title,
      anime.originalTitle,
      anime.synopsis,
      source.synopsis,
      source.background,
      source.source,
      source.season,
      ...anime.genres.map((genre) => genre.name),
      ...this.getResourceNames(source.genres),
      ...this.getResourceNames(source.themes),
      ...this.getResourceNames(source.demographics),
    ];

    return values
      .filter((value): value is string => Boolean(value))
      .join(' ')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  

  private async withSpanishSynopsis(anime: AnimeDto): Promise<AnimeDto> {
    return {
      ...anime,
      synopsis: await this.translateSynopsisToSpanish(
        anime.synopsis,
        anime.id,
      ),
    };
  }

  private async translateSynopsisToSpanish(
    synopsis: string,
    animeId?: number | string,
  ): Promise<string> {
    const cleanSynopsis = synopsis.trim();

    if (!cleanSynopsis) {
      return 'Sinopsis no disponible.';
    }

    if (!this.translateSynopses) {
      this.logger.warn(
        `Traducción desactivada. animeId=${animeId ?? 'unknown'}`,
      );
      return cleanSynopsis;
    }

    const chunks = this.splitTextIntoChunksByBytes(
      cleanSynopsis,
      AnimeService.TRANSLATION_CHUNK_MAX_BYTES,
    );

    if (chunks.length === 0) {
      return cleanSynopsis;
    }

    this.logger.log(
      `Traduciendo sinopsis animeId=${animeId ?? 'unknown'} chunks=${chunks.length}`,
    );

    const translatedChunks: string[] = [];

    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      const translatedChunk = await this.translateChunkWithFallbackProviders(
        chunk,
        index + 1,
        chunks.length,
        animeId,
      );

      translatedChunks.push(translatedChunk);
    }

    const translated = translatedChunks.join(' ').replace(/\s+/g, ' ').trim();

    if (!translated) {
      return cleanSynopsis;
    }

    return translated;
  }

  private async translateChunkWithFallbackProviders(
    text: string,
    chunkNumber: number,
    totalChunks: number,
    animeId?: number | string,
  ): Promise<string> {
    try {
      const translatedByMyMemory = await this.translateChunkWithMyMemory(text);

      if (this.isUsableSpanishTranslation(translatedByMyMemory, text)) {
        return translatedByMyMemory;
      }

      this.logger.warn(
        `MyMemory devolvió una traducción no utilizable. animeId=${animeId ?? 'unknown'
        } chunk=${chunkNumber}/${totalChunks}`,
      );
    } catch (error) {
      this.logger.warn(
        `MyMemory falló. animeId=${animeId ?? 'unknown'} chunk=${chunkNumber}/${totalChunks}. Motivo: ${this.getErrorMessage(
          error,
        )}`,
      );
    }

    try {
      const translatedByGoogle = await this.translateChunkWithGoogle(text);

      if (this.isUsableSpanishTranslation(translatedByGoogle, text)) {
        return translatedByGoogle;
      }

      this.logger.warn(
        `Google Translate devolvió una traducción no utilizable. animeId=${animeId ?? 'unknown'
        } chunk=${chunkNumber}/${totalChunks}`,
      );
    } catch (error) {
      this.logger.warn(
        `Google Translate falló. animeId=${animeId ?? 'unknown'} chunk=${chunkNumber}/${totalChunks}. Motivo: ${this.getErrorMessage(
          error,
        )}`,
      );
    }

    /**
     * Último respaldo:
     * Se conserva el texto original solo si ambos proveedores fallan.
     * Si aquí sigue saliendo inglés, el log anterior dirá exactamente cuál proveedor falló.
     */
    return text;
  }

  private async translateChunkWithMyMemory(text: string): Promise<string> {
    const params: Record<string, string | number> = {
      q: text,
      langpair: 'en|es',
      mt: 1,
    };

    if (this.translationEmail) {
      params.de = this.translationEmail;
    }

    const response = await lastValueFrom(
      this.httpService.get<MyMemoryTranslationResponse>(
        this.translationBaseUrl,
        {
          params,
          timeout: AnimeService.MYMEMORY_TIMEOUT_MS,
        },
      ),
    );

    const translatedText = response.data?.responseData?.translatedText?.trim();

    if (translatedText && !this.isInvalidProviderMessage(translatedText)) {
      return this.decodeHtmlEntities(translatedText);
    }

    const responseStatus = Number(response.data?.responseStatus ?? 0);

    throw new Error(
      response.data?.responseDetails ??
      `MyMemory returned invalid response. status=${responseStatus}`,
    );
  }

  private async translateChunkWithGoogle(text: string): Promise<string> {
    const response = await lastValueFrom(
      this.httpService.get<GoogleTranslateResponse>(
        AnimeService.GOOGLE_TRANSLATE_URL,
        {
          params: {
            client: 'gtx',
            sl: 'en',
            tl: 'es',
            dt: 't',
            q: text,
          },
          timeout: AnimeService.GOOGLE_TRANSLATE_TIMEOUT_MS,
        },
      ),
    );

    const translatedText = response.data?.[0]
      ?.map((item) => item?.[0] ?? '')
      .join('')
      .trim();

    if (!translatedText || this.isInvalidProviderMessage(translatedText)) {
      throw new Error('Google Translate returned invalid translatedText');
    }

    return this.decodeHtmlEntities(translatedText);
  }

  private isUsableSpanishTranslation(
    translatedText: string,
    originalText: string,
  ): boolean {
    const translated = translatedText.trim();
    const original = originalText.trim();

    if (!translated) {
      return false;
    }

    if (this.normalizeText(translated) === this.normalizeText(original)) {
      return false;
    }

    if (this.isInvalidProviderMessage(translated)) {
      return false;
    }

    return true;
  }

  private isInvalidProviderMessage(text: string): boolean {
    const normalized = text.toLowerCase();

    return (
      normalized.includes('quota') ||
      normalized.includes('available free translations') ||
      normalized.includes('please provide') ||
      normalized.includes('invalid language pair') ||
      normalized.includes('select two distinct languages') ||
      normalized.includes('translated.net') ||
      normalized.includes('mymemory warning')
    );
  }

  private splitTextIntoChunksByBytes(text: string, maxBytes: number): string[] {
    const normalizedText = text.replace(/\s+/g, ' ').trim();

    if (!normalizedText) {
      return [];
    }

    const sentences = normalizedText
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);

    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      const candidate = currentChunk ? `${currentChunk} ${sentence}` : sentence;

      if (this.getUtf8ByteLength(candidate) <= maxBytes) {
        currentChunk = candidate;
        continue;
      }

      if (currentChunk) {
        chunks.push(currentChunk);
      }

      if (this.getUtf8ByteLength(sentence) <= maxBytes) {
        currentChunk = sentence;
        continue;
      }

      const pieces = this.splitLongTextByBytes(sentence, maxBytes);

      chunks.push(...pieces.slice(0, -1));
      currentChunk = pieces[pieces.length - 1] ?? '';
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  private splitLongTextByBytes(text: string, maxBytes: number): string[] {
    const words = text.split(' ');
    const chunks: string[] = [];

    let currentChunk = '';

    for (const word of words) {
      const candidate = currentChunk ? `${currentChunk} ${word}` : word;

      if (this.getUtf8ByteLength(candidate) <= maxBytes) {
        currentChunk = candidate;
        continue;
      }

      if (currentChunk) {
        chunks.push(currentChunk);
      }

      if (this.getUtf8ByteLength(word) <= maxBytes) {
        currentChunk = word;
        continue;
      }

      const pieces = this.splitVeryLongWordByBytes(word, maxBytes);

      chunks.push(...pieces.slice(0, -1));
      currentChunk = pieces[pieces.length - 1] ?? '';
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  private splitVeryLongWordByBytes(word: string, maxBytes: number): string[] {
    const chunks: string[] = [];
    let currentChunk = '';

    for (let index = 0; index < word.length; index += 1) {
      const codePoint = word.codePointAt(index);
      const char = String.fromCodePoint(codePoint ?? word.charCodeAt(index));

      if (codePoint && codePoint > 0xffff) {
        index += 1;
      }

      const candidate = currentChunk + char;

      if (this.getUtf8ByteLength(candidate) <= maxBytes) {
        currentChunk = candidate;
        continue;
      }

      if (currentChunk) {
        chunks.push(currentChunk);
      }

      currentChunk = char;
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  private getUtf8ByteLength(text: string): number {
    return Buffer.byteLength(text, 'utf8');
  }

  private decodeHtmlEntities(text: string): string {
    return text
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  }

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[.,;:!?'“”‘’()[\]{}-]/g, '')
      .trim();
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}