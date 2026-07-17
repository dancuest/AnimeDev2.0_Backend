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
import { Prisma } from '@prisma/client';
import { Cache } from 'cache-manager';
import { lastValueFrom } from 'rxjs';

import { PrismaService } from '../../prisma/prisma.service';
import { getStaticJikanGenres } from './anime-genre.catalog';
import { AnimeMapper } from './anime.mapper';
import {
  AnimeDetailDto,
  AnimeRelationType,
  RelatedAnimeDto,
} from './dto/anime-detail.dto';
import {
  AnimeDto,
  DurationType,
  EmissionStatus,
  GenreDto,
} from './dto/anime.dto';
import {
  AnimeProviderError,
  AnimeProviderName,
} from './providers/anime-provider.types';
import { AniListProvider } from './providers/anilist.provider';
import { JikanProvider } from './providers/jikan.provider';
import { KitsuProvider } from './providers/kitsu.provider';
import { JikanAnime } from './types/jikan.types';

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

type CacheSource = AnimeProviderName | 'fallback' | 'derived';

interface PersistentCacheEntry<T> {
  value: T;
  updatedAt: Date;
  source: string;
}

interface ProviderResolution<T> {
  value: T;
  source: CacheSource;
}

type ProviderCallbacks<T> = Record<AnimeProviderName, () => Promise<T>>;

@Injectable()
export class AnimeService {
  private readonly logger = new Logger(AnimeService.name);

  private get prismaCacheClient(): PrismaService & { animeApiCache: any } {
    return this.prisma as PrismaService & { animeApiCache: any };
  }

  private readonly cacheTtlMs: number;
  private readonly shortCacheTtlMs: number;
  private readonly translateSynopses: boolean;
  private readonly translationBaseUrl: string;
  private readonly translationEmail?: string;
  private readonly providerOrder: AnimeProviderName[];

  private static readonly ADULT_GENRE_IDS = new Set(['9', '12', '49']);

  private static readonly EMERGENCY_CATALOG: AnimeDto[] = [
    {
      id: 5114,
      externalApiId: '5114',
      title: 'Fullmetal Alchemist: Brotherhood',
      originalTitle: 'Hagane no Renkinjutsushi: Fullmetal Alchemist',
      synopsis:
        'Dos hermanos alquimistas buscan recuperar sus cuerpos después de un experimento fallido, mientras descubren una conspiración que amenaza a toda su nación.',
      coverImageUrl: '',
      mangaPlusUrl: '',
      mangaUrl: null,
      mangaTitle: null,
      trailerUrl: null,
      totalEpisodes: 64,
      durationType: DurationType.MEDIUM,
      emissionStatus: EmissionStatus.FINISHED,
      releaseYear: 2009,
      genres: [
        { id: '1', name: 'Acción' },
        { id: '2', name: 'Aventura' },
        { id: '8', name: 'Drama' },
        { id: '10', name: 'Fantasía' },
      ],
    },
    {
      id: 11061,
      externalApiId: '11061',
      title: 'Hunter x Hunter',
      originalTitle: 'Hunter x Hunter (2011)',
      synopsis:
        'Un joven inicia un exigente viaje para convertirse en cazador y encontrar a su padre, formando amistades y enfrentando desafíos cada vez mayores.',
      coverImageUrl: '',
      mangaPlusUrl: '',
      mangaUrl: null,
      mangaTitle: null,
      trailerUrl: null,
      totalEpisodes: 148,
      durationType: DurationType.MEDIUM,
      emissionStatus: EmissionStatus.FINISHED,
      releaseYear: 2011,
      genres: [
        { id: '1', name: 'Acción' },
        { id: '2', name: 'Aventura' },
        { id: '10', name: 'Fantasía' },
        { id: '27', name: 'Shōnen' },
      ],
    },
    {
      id: 9253,
      externalApiId: '9253',
      title: 'Steins;Gate',
      originalTitle: 'Steins;Gate',
      synopsis:
        'Un grupo de amigos descubre accidentalmente una forma de alterar el pasado y debe afrontar las consecuencias de cambiar distintas líneas temporales.',
      coverImageUrl: '',
      mangaPlusUrl: '',
      mangaUrl: null,
      mangaTitle: null,
      trailerUrl: null,
      totalEpisodes: 24,
      durationType: DurationType.MEDIUM,
      emissionStatus: EmissionStatus.FINISHED,
      releaseYear: 2011,
      genres: [
        { id: '8', name: 'Drama' },
        { id: '24', name: 'Ciencia ficción' },
        { id: '41', name: 'Suspenso' },
        { id: '78', name: 'Viajes en el tiempo' },
      ],
    },
    {
      id: 21,
      externalApiId: '21',
      title: 'One Piece',
      originalTitle: 'One Piece',
      synopsis:
        'Un joven pirata reúne una tripulación para recorrer los mares, encontrar un tesoro legendario y alcanzar su sueño de convertirse en Rey de los Piratas.',
      coverImageUrl: '',
      mangaPlusUrl: '',
      mangaUrl: null,
      mangaTitle: null,
      trailerUrl: null,
      totalEpisodes: null,
      durationType: DurationType.MEDIUM,
      emissionStatus: EmissionStatus.ON_AIR,
      releaseYear: 1999,
      genres: [
        { id: '1', name: 'Acción' },
        { id: '2', name: 'Aventura' },
        { id: '10', name: 'Fantasía' },
        { id: '27', name: 'Shōnen' },
      ],
    },
    {
      id: 1535,
      externalApiId: '1535',
      title: 'Death Note',
      originalTitle: 'Death Note',
      synopsis:
        'Un estudiante encuentra un cuaderno sobrenatural capaz de matar y comienza una batalla intelectual contra el detective que intenta detenerlo.',
      coverImageUrl: '',
      mangaPlusUrl: '',
      mangaUrl: null,
      mangaTitle: null,
      trailerUrl: null,
      totalEpisodes: 37,
      durationType: DurationType.MEDIUM,
      emissionStatus: EmissionStatus.FINISHED,
      releaseYear: 2006,
      genres: [
        { id: '7', name: 'Misterio' },
        { id: '37', name: 'Sobrenatural' },
        { id: '40', name: 'Psicológico' },
        { id: '41', name: 'Suspenso' },
      ],
    },
    {
      id: 16498,
      externalApiId: '16498',
      title: 'Attack on Titan',
      originalTitle: 'Shingeki no Kyojin',
      synopsis:
        'La humanidad vive protegida por enormes murallas hasta que la aparición de gigantes desencadena una guerra por la supervivencia y la verdad.',
      coverImageUrl: '',
      mangaPlusUrl: '',
      mangaUrl: null,
      mangaTitle: null,
      trailerUrl: null,
      totalEpisodes: 25,
      durationType: DurationType.MEDIUM,
      emissionStatus: EmissionStatus.FINISHED,
      releaseYear: 2013,
      genres: [
        { id: '1', name: 'Acción' },
        { id: '8', name: 'Drama' },
        { id: '38', name: 'Militar' },
        { id: '41', name: 'Suspenso' },
      ],
    },
    {
      id: 30276,
      externalApiId: '30276',
      title: 'One Punch Man',
      originalTitle: 'One Punch Man',
      synopsis:
        'Un héroe capaz de derrotar a cualquier enemigo con un solo golpe busca un desafío que le permita recuperar la emoción de combatir.',
      coverImageUrl: '',
      mangaPlusUrl: '',
      mangaUrl: null,
      mangaTitle: null,
      trailerUrl: null,
      totalEpisodes: 12,
      durationType: DurationType.MEDIUM,
      emissionStatus: EmissionStatus.FINISHED,
      releaseYear: 2015,
      genres: [
        { id: '1', name: 'Acción' },
        { id: '4', name: 'Comedia' },
        { id: '24', name: 'Ciencia ficción' },
        { id: '31', name: 'Superpoderes' },
      ],
    },
    {
      id: 38000,
      externalApiId: '38000',
      title: 'Demon Slayer',
      originalTitle: 'Kimetsu no Yaiba',
      synopsis:
        'Un joven se convierte en cazador de demonios para proteger a su hermana y encontrar una forma de devolverle su humanidad.',
      coverImageUrl: '',
      mangaPlusUrl: '',
      mangaUrl: null,
      mangaTitle: null,
      trailerUrl: null,
      totalEpisodes: 26,
      durationType: DurationType.MEDIUM,
      emissionStatus: EmissionStatus.FINISHED,
      releaseYear: 2019,
      genres: [
        { id: '1', name: 'Acción' },
        { id: '10', name: 'Fantasía' },
        { id: '13', name: 'Histórico' },
        { id: '27', name: 'Shōnen' },
      ],
    },
    {
      id: 52991,
      externalApiId: '52991',
      title: 'Frieren: Beyond Journey’s End',
      originalTitle: 'Sousou no Frieren',
      synopsis:
        'Una elfa inmortal emprende un nuevo viaje para comprender mejor a las personas y el significado de los recuerdos que dejó su antigua aventura.',
      coverImageUrl: '',
      mangaPlusUrl: '',
      mangaUrl: null,
      mangaTitle: null,
      trailerUrl: null,
      totalEpisodes: 28,
      durationType: DurationType.MEDIUM,
      emissionStatus: EmissionStatus.FINISHED,
      releaseYear: 2023,
      genres: [
        { id: '2', name: 'Aventura' },
        { id: '8', name: 'Drama' },
        { id: '10', name: 'Fantasía' },
      ],
    },
    {
      id: 50265,
      externalApiId: '50265',
      title: 'SPY x FAMILY',
      originalTitle: 'Spy x Family',
      synopsis:
        'Un espía forma una familia falsa para cumplir una misión sin saber que su esposa es asesina y su hija puede leer la mente.',
      coverImageUrl: '',
      mangaPlusUrl: '',
      mangaUrl: null,
      mangaTitle: null,
      trailerUrl: null,
      totalEpisodes: 12,
      durationType: DurationType.MEDIUM,
      emissionStatus: EmissionStatus.FINISHED,
      releaseYear: 2022,
      genres: [
        { id: '1', name: 'Acción' },
        { id: '4', name: 'Comedia' },
        { id: '50', name: 'Elenco adulto' },
      ],
    },
  ];

  /**
   * MyMemory limita q a 500 bytes UTF-8.
   * Se usa 380 para dejar margen operativo y evitar rechazos silenciosos.
   */

  private static readonly TRANSLATION_CHUNK_MAX_BYTES = 380;
  private static readonly MYMEMORY_TIMEOUT_MS = 12_000;
  private static readonly GOOGLE_TRANSLATE_TIMEOUT_MS = 15_000;
  private static readonly GOOGLE_TRANSLATE_URL =
    'https://translate.googleapis.com/translate_a/single';

  private static readonly PERSISTENT_CACHE_MAX_STALE_MS =
    90 * 24 * 60 * 60 * 1_000;
  private static readonly PERSISTENT_FALLBACK_MEMORY_TTL_MS =
    5 * 60 * 1_000;

  private readonly inFlightRequests = new Map<string, Promise<unknown>>();

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly mapper: AnimeMapper,
    private readonly prisma: PrismaService,
    private readonly aniListProvider: AniListProvider,
    private readonly jikanProvider: JikanProvider,
    private readonly kitsuProvider: KitsuProvider,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {
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

    this.providerOrder = this.parseProviderOrder(
      this.configService.get<string>('animeProviderOrder') ??
        'anilist,jikan,kitsu',
    );

    this.logger.log(
      `AnimeService iniciado. providers=${this.providerOrder.join(' -> ')}, ` +
        `translateSynopses=${this.translateSynopses}, ` +
        `translationEmail=${
          this.translationEmail ? 'configurado' : 'no configurado'
        }`,
    );
  }

  async getTop(limit = 10, requestId?: string, includeAdult?: boolean) {
    const safeLimit = this.clampLimit(limit, 50);
    const cacheKey = `anime:top:multi:v1:${safeLimit}:${
      includeAdult === true ? 'all' : 'sfw'
    }`;

    const data = await this.getCached(
      cacheKey,
      async () => {
        const resolved = await this.resolveProviders(
          'top',
          {
            anilist: async () => {
              const response = await this.aniListProvider.getTop(
                safeLimit,
                includeAdult === true,
              );
              return response.data.map((anime) =>
                this.mapper.toAnimeDto(anime),
              );
            },
            jikan: async () => {
              const response = await this.jikanProvider.getTop(
                safeLimit,
                includeAdult === true,
              );
              return response.data.map((anime) =>
                this.mapper.toAnimeDto(anime),
              );
            },
            kitsu: async () => {
              const response = await this.kitsuProvider.getTop(
                safeLimit,
                includeAdult === true,
              );
              return response.data.map((anime) =>
                this.mapper.toAnimeDto(anime),
              );
            },
          },
          requestId,
          (items) => items.length > 0,
        );

        await this.rememberAnimeSnapshots(resolved.value, resolved.source);
        return resolved;
      },
      this.shortCacheTtlMs,
      async () => {
        const stored = await this.getStoredAnimeSnapshots(safeLimit);
        const items =
          stored.length > 0
            ? stored
            : this.getEmergencyCatalog().slice(0, safeLimit);

        await this.rememberAnimeSnapshots(items, 'fallback');
        return items;
      },
    );

    return {
      data,
      meta: {
        limit: safeLimit,
      },
    };
  }

  async search(
    query: string,
    limit = 10,
    requestId?: string,
    includeAdult?: boolean,
  ) {
    const normalizedQuery = query.trim().toLowerCase();
    const safeLimit = this.clampLimit(limit, 50);

    const cacheKey = `anime:search:multi:v1:${normalizedQuery}:${safeLimit}:${
      includeAdult === true ? 'all' : 'sfw'
    }`;

    return this.getCached(
      cacheKey,
      async () => {
        const resolved = await this.resolveProviders(
          `search:${normalizedQuery}`,
          {
            anilist: async () => {
              const response = await this.aniListProvider.search(
                query,
                safeLimit,
                includeAdult === true,
              );

              return {
                data: response.data.map((anime) =>
                  this.mapper.toAnimeDto(anime),
                ),
                meta: {
                  limit: safeLimit,
                  total: response.total,
                  count: response.count,
                  hasNextPage: response.hasNextPage,
                },
              };
            },
            jikan: async () => {
              const response = await this.jikanProvider.search(
                query,
                safeLimit,
                includeAdult === true,
              );

              return {
                data: response.data.map((anime) =>
                  this.mapper.toAnimeDto(anime),
                ),
                meta: {
                  limit: safeLimit,
                  total: response.total,
                  count: response.count,
                  hasNextPage: response.hasNextPage,
                },
              };
            },
            kitsu: async () => {
              const response = await this.kitsuProvider.search(
                query,
                safeLimit,
                includeAdult === true,
              );

              return {
                data: response.data.map((anime) =>
                  this.mapper.toAnimeDto(anime),
                ),
                meta: {
                  limit: safeLimit,
                  total: response.total,
                  count: response.count,
                  hasNextPage: response.hasNextPage,
                },
              };
            },
          },
          requestId,
          () => true,
        );

        await this.rememberAnimeSnapshots(
          resolved.value.data,
          resolved.source,
        );

        return resolved;
      },
      this.shortCacheTtlMs,
      async () => {
        const items = await this.searchStoredAnime(query, safeLimit);
        const emergencyItems = this.getEmergencyCatalog()
          .filter((anime) => {
            const searchable = this.normalizeText(
              `${anime.title} ${anime.originalTitle ?? ''} ${
                anime.synopsis
              }`,
            );

            return searchable.includes(this.normalizeText(query));
          })
          .slice(0, safeLimit);

        const data = items.length > 0 ? items : emergencyItems;

        return {
          data,
          meta: {
            limit: safeLimit,
            total: data.length,
            count: data.length,
            hasNextPage: false,
          },
        };
      },
    );
  }

  async getById(
    id: number,
    requestId?: string,
    translateSynopsis = true,
  ): Promise<{ data: AnimeDto }> {
    const rawCacheKey = `anime:${id}:raw:multi:v1`;

    const rawAnime = await this.getCached(
      rawCacheKey,
      async () => {
        const resolved = await this.resolveProviders(
          `anime:${id}`,
          {
            anilist: async () =>
              this.mapper.toAnimeDto(
                await this.aniListProvider.getByMalId(id),
              ),
            jikan: async () =>
              this.mapper.toAnimeDto(
                await this.jikanProvider.getByMalId(id),
              ),
            kitsu: async () =>
              this.mapper.toAnimeDto(
                await this.kitsuProvider.getByMalId(id),
              ),
          },
          requestId,
          (anime) => anime.id === id,
        );

        await this.rememberAnimeSnapshots(
          [resolved.value],
          resolved.source,
        );

        return resolved;
      },
      this.cacheTtlMs,
      async () => {
        const storedAnime = await this.findStoredAnimeById(id);
        const emergencyAnime = this.getEmergencyCatalog().find(
          (anime) => anime.id === id,
        );

        return storedAnime ?? emergencyAnime ?? null;
      },
    );

    if (!translateSynopsis) {
      return { data: rawAnime };
    }

    const translatedCacheKey = `anime:${id}:es:multi:v1`;

    const translatedAnime = await this.getCached(
      translatedCacheKey,
      async () => ({
        value: await this.withSpanishSynopsis(rawAnime),
        source: 'derived',
      }),
      this.cacheTtlMs,
      () => rawAnime,
    );

    return { data: translatedAnime };
  }

  async getDetail(
    id: number,
    requestId?: string,
  ): Promise<{ data: AnimeDetailDto }> {
    const cacheKey = `anime:detail:${id}:full:multi:es:v1`;

    const detail = await this.getCached(
      cacheKey,
      async () => {
        const resolved = await this.resolveProviders(
          `detail:${id}`,
          {
            anilist: async () =>
              this.aniListProvider.getFullByMalId(id),
            jikan: async () =>
              this.jikanProvider.getFullByMalId(id),
            kitsu: async () =>
              this.kitsuProvider.getFullByMalId(id),
          },
          requestId,
          (anime) => anime.mal_id === id,
        );

        const anime = this.mapper.toAnimeDto(resolved.value);

        await this.rememberAnimeSnapshots([anime], resolved.source);

        const animeWithSpanishSynopsis = await this.withSpanishSynopsis(anime);

        return {
          value: {
            anime: animeWithSpanishSynopsis,
            culturalNotes: this.buildCulturalNotes(
              animeWithSpanishSynopsis,
              resolved.value,
            ),
            trailers: [],
            relatedAnime: this.buildRelatedAnime(resolved.value),
          },
          source: resolved.source,
        };
      },
      this.cacheTtlMs,
      async () => {
        const anime = (await this.getById(id, requestId, true)).data;

        return {
          anime,
          culturalNotes: this.buildFallbackCulturalNotes(anime),
          trailers: [],
          relatedAnime: [],
        };
      },
    );

    return { data: detail };
  }

  async getHero(requestId?: string): Promise<{ data: AnimeDto }> {
    const cacheKey = 'anime:hero:multi:es:v1';

    const anime = await this.getCached(
      cacheKey,
      async () => {
        const top = await this.getTop(12, requestId, false);
        const items = top.data;

        if (items.length === 0) {
          return {
            value: this.getEmergencyCatalog()[0],
            source: 'fallback',
          };
        }

        const selectedAnime =
          items[Math.floor(Math.random() * items.length)];

        return {
          value: await this.withSpanishSynopsis(selectedAnime),
          source: 'derived',
        };
      },
      this.shortCacheTtlMs,
      () => this.getEmergencyCatalog()[0],
    );

    return { data: anime };
  }

  async getByGenre(
    genreId: string,
    limit = 10,
    requestId?: string,
    includeAdult?: boolean,
  ): Promise<{ data: AnimeDto[]; meta: { limit: number } }> {
    const safeLimit = this.clampLimit(limit, 50);
    const cacheKey = `anime:genre:multi:v1:${genreId}:${safeLimit}:${
      includeAdult === true ? 'all' : 'sfw'
    }`;

    const data = await this.getCached(
      cacheKey,
      async () => {
        const resolved = await this.resolveProviders(
          `genre:${genreId}`,
          {
            anilist: async () => {
              const response = await this.aniListProvider.getByGenre(
                genreId,
                safeLimit,
                includeAdult === true,
              );

              return response.data.map((anime) =>
                this.mapper.toAnimeDto(anime),
              );
            },
            jikan: async () => {
              const response = await this.jikanProvider.getByGenre(
                genreId,
                safeLimit,
                includeAdult === true,
              );

              return response.data.map((anime) =>
                this.mapper.toAnimeDto(anime),
              );
            },
            kitsu: async () => {
              const response = await this.kitsuProvider.getByGenre(
                genreId,
                safeLimit,
                includeAdult === true,
              );

              return response.data.map((anime) =>
                this.mapper.toAnimeDto(anime),
              );
            },
          },
          requestId,
          (items) => items.length > 0,
        );

        await this.rememberAnimeSnapshots(resolved.value, resolved.source);
        return resolved;
      },
      this.shortCacheTtlMs,
      async () => {
        const stored = await this.getStoredAnimeSnapshots(300);
        const matched = stored.filter((anime) =>
          anime.genres.some((genre) => genre.id === genreId),
        );

        const emergency = this.getEmergencyCatalog().filter((anime) =>
          anime.genres.some((genre) => genre.id === genreId),
        );

        const data =
          matched.length > 0
            ? matched
            : emergency.length > 0
              ? emergency
              : stored.length > 0
                ? stored
                : this.getEmergencyCatalog();

        return data.slice(0, safeLimit);
      },
    );

    return {
      data,
      meta: { limit: safeLimit },
    };
  }

  async getGenres(
    includeAdult = true,
    _requestId?: string,
  ): Promise<{ data: GenreDto[] }> {
    const cacheKey = `anime:genres:static:v2:${
      includeAdult ? 'all' : 'safe'
    }`;

    const genres = await this.getCached(
      cacheKey,
      async () => {
        const mappedGenres = getStaticJikanGenres().map((genre) =>
          this.mapper.toGenreDto(genre),
        );

        return {
          value: includeAdult
            ? mappedGenres
            : mappedGenres.filter(
                (genre) =>
                  !AnimeService.ADULT_GENRE_IDS.has(genre.id),
              ),
          source: 'derived',
        };
      },
      this.cacheTtlMs,
    );

    return { data: genres };
  }

  async getManyByIds(
    animeIds: number[],
    requestId?: string,
    translateSynopsis = false,
  ): Promise<AnimeDto[]> {
    const orderedIds = Array.from(
      new Set(
        animeIds.filter(
          (id) => Number.isInteger(id) && id > 0,
        ),
      ),
    ).slice(0, 20);

    if (orderedIds.length === 0) {
      return [];
    }

    const resolved = new Map<number, AnimeDto>();

    const cached = await this.getCachedAnimesByIds(orderedIds);

    for (const anime of cached) {
      resolved.set(anime.id, anime);
    }

    let missing = orderedIds.filter((id) => !resolved.has(id));

    if (missing.length > 0) {
      try {
        const anilistItems =
          await this.aniListProvider.getManyByMalIds(missing);

        const mappedItems = anilistItems.map((anime) =>
          this.mapper.toAnimeDto(anime),
        );

        await this.rememberAnimeSnapshots(mappedItems, 'anilist');

        for (const anime of mappedItems) {
          resolved.set(anime.id, anime);
        }
      } catch (error) {
        this.logger.warn(
          `No se pudo completar el lote con AniList: ${this.getErrorMessage(
            error,
          )}`,
        );
      }
    }

    missing = orderedIds.filter((id) => !resolved.has(id));

    for (const animeId of missing.slice(0, 5)) {
      try {
        const item = await this.resolveProviders(
          `batch-item:${animeId}`,
          {
            anilist: async () =>
              this.mapper.toAnimeDto(
                await this.aniListProvider.getByMalId(animeId),
              ),
            jikan: async () =>
              this.mapper.toAnimeDto(
                await this.jikanProvider.getByMalId(animeId),
              ),
            kitsu: async () =>
              this.mapper.toAnimeDto(
                await this.kitsuProvider.getByMalId(animeId),
              ),
          },
          requestId,
          (anime) => anime.id === animeId,
        );

        resolved.set(animeId, item.value);
        await this.rememberAnimeSnapshots(
          [item.value],
          item.source,
        );
      } catch (error) {
        this.logger.warn(
          `No se pudo completar animeId=${animeId}: ${this.getErrorMessage(
            error,
          )}`,
        );
      }
    }

    const ordered = orderedIds
      .map((id) => resolved.get(id))
      .filter((anime): anime is AnimeDto => Boolean(anime));

    if (!translateSynopsis) {
      return ordered;
    }

    const translated: AnimeDto[] = [];

    for (const anime of ordered) {
      translated.push(await this.withSpanishSynopsis(anime));
    }

    return translated;
  }

  async getCachedAnimesByIds(animeIds: number[]): Promise<AnimeDto[]> {
    const orderedIds = Array.from(new Set(animeIds));

    if (orderedIds.length === 0) {
      return [];
    }

    const resolved = new Map<number, AnimeDto>();

    for (const animeId of orderedIds) {
      const memory = await this.cacheManager.get<AnimeDto>(
        `anime:${animeId}:raw:multi:v1`,
      );

      if (memory) {
        resolved.set(animeId, memory);
        continue;
      }

      const persistent = await this.readPersistentCache<AnimeDto>(
        `anime:${animeId}:raw:multi:v1`,
      );

      if (persistent?.value) {
        resolved.set(animeId, persistent.value);
        await this.cacheManager.set(
          `anime:${animeId}:raw:multi:v1`,
          persistent.value,
          this.cacheTtlMs,
        );
      }
    }

    return orderedIds
      .map((id) => resolved.get(id))
      .filter((anime): anime is AnimeDto => Boolean(anime));
  }

  private async resolveProviders<T>(
    operation: string,
    callbacks: ProviderCallbacks<T>,
    requestId: string | undefined,
    isUsable: (value: T) => boolean,
  ): Promise<ProviderResolution<T>> {
    const failures: Array<{
      provider: AnimeProviderName;
      status: number | null;
      message: string;
    }> = [];

    for (const provider of this.providerOrder) {
      try {
        const value = await callbacks[provider]();

        if (!isUsable(value)) {
          throw new AnimeProviderError(
            provider,
            operation,
            HttpStatus.BAD_GATEWAY,
            `${provider} devolvió una respuesta vacía o incompatible.`,
          );
        }

        this.logger.log(
          `Proveedor ${provider} respondió correctamente en ${operation}.`,
        );

        return {
          value,
          source: provider,
        };
      } catch (error) {
        const providerError = this.toProviderError(
          provider,
          operation,
          error,
        );

        failures.push({
          provider,
          status: providerError.upstreamStatus,
          message: providerError.message,
        });

        this.logger.warn(
          `Proveedor ${provider} falló en ${operation}: ` +
            `${providerError.message} ` +
            `(status=${providerError.upstreamStatus ?? 'network'})`,
        );
      }
    }

    throw new HttpException(
      {
        error: {
          code: 'ALL_ANIME_PROVIDERS_FAILED',
          message:
            'AniList, Jikan y Kitsu no pudieron responder. Se intentará utilizar la información almacenada.',
          operation,
          providers: failures,
          requestId: requestId ?? null,
        },
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  private toProviderError(
    provider: AnimeProviderName,
    operation: string,
    error: unknown,
  ): AnimeProviderError {
    if (error instanceof AnimeProviderError) {
      return error;
    }

    const status = (error as { response?: { status?: number } })?.response
      ?.status;

    return new AnimeProviderError(
      provider,
      operation,
      typeof status === 'number' ? status : null,
      this.getErrorMessage(error),
    );
  }

  private parseProviderOrder(value: string): AnimeProviderName[] {
    const valid = new Set<AnimeProviderName>([
      'anilist',
      'jikan',
      'kitsu',
    ]);

    const parsed = value
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(
        (entry): entry is AnimeProviderName =>
          valid.has(entry as AnimeProviderName),
      );

    const unique = Array.from(new Set(parsed));

    for (const provider of valid) {
      if (!unique.includes(provider)) {
        unique.push(provider);
      }
    }

    return unique;
  }

  private async getCached<T>(
    key: string,
    fetcher: () => Promise<ProviderResolution<T>>,
    ttlMs = this.cacheTtlMs,
    fallback?: (
      error: unknown,
    ) => Promise<T | null | undefined> | T | null | undefined,
  ): Promise<T> {
    const memoryCached = await this.cacheManager.get<T>(key);

    if (memoryCached !== undefined && memoryCached !== null) {
      return memoryCached;
    }

    const existingRequest = this.inFlightRequests.get(key) as
      | Promise<T>
      | undefined;

    if (existingRequest) {
      return existingRequest;
    }

    const request = (async () => {
      const persistent = await this.readPersistentCache<T>(key);
      const persistentAgeMs = persistent
        ? Date.now() - persistent.updatedAt.getTime()
        : Number.POSITIVE_INFINITY;

      if (persistent && persistentAgeMs <= ttlMs) {
        await this.cacheManager.set(key, persistent.value, ttlMs);
        return persistent.value;
      }

      try {
        const fresh = await fetcher();

        await Promise.all([
          this.cacheManager.set(key, fresh.value, ttlMs),
          this.writePersistentCache(
            key,
            fresh.value,
            fresh.source,
          ),
        ]);

        return fresh.value;
      } catch (error) {
        if (
          persistent &&
          persistentAgeMs <=
            AnimeService.PERSISTENT_CACHE_MAX_STALE_MS
        ) {
          this.logger.warn(
            `Se usa caché persistente para ${key}, antigüedad=${Math.round(
              persistentAgeMs / 1_000,
            )}s, source=${persistent.source}.`,
          );

          await this.cacheManager.set(
            key,
            persistent.value,
            AnimeService.PERSISTENT_FALLBACK_MEMORY_TTL_MS,
          );

          return persistent.value;
        }

        const fallbackValue = fallback ? await fallback(error) : null;

        if (
          fallbackValue !== undefined &&
          fallbackValue !== null
        ) {
          await Promise.all([
            this.cacheManager.set(
              key,
              fallbackValue,
              AnimeService.PERSISTENT_FALLBACK_MEMORY_TTL_MS,
            ),
            this.writePersistentCache(
              key,
              fallbackValue,
              'fallback',
            ),
          ]);

          return fallbackValue;
        }

        throw error;
      }
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

  private async readPersistentCache<T>(
    key: string,
  ): Promise<PersistentCacheEntry<T> | null> {
    try {
      const row = await this.prismaCacheClient.animeApiCache.findUnique({
        where: { key },
      });

      if (!row) {
        return null;
      }

      return {
        value: row.payload as unknown as T,
        updatedAt: row.updatedAt,
        source: row.source,
      };
    } catch (error) {
      this.logger.warn(
        `No se pudo leer la caché persistente key=${key}: ${this.getErrorMessage(
          error,
        )}`,
      );
      return null;
    }
  }

  private async writePersistentCache<T>(
    key: string,
    value: T,
    source: CacheSource,
  ): Promise<void> {
    try {
      await this.prismaCacheClient.animeApiCache.upsert({
        where: { key },
        create: {
          key,
          payload: value as unknown as Prisma.InputJsonValue,
          source,
        },
        update: {
          payload: value as unknown as Prisma.InputJsonValue,
          source,
        },
      });
    } catch (error) {
      this.logger.warn(
        `No se pudo guardar la caché persistente key=${key}: ${this.getErrorMessage(
          error,
        )}`,
      );
    }
  }

  private async rememberAnimeSnapshots(
    animes: AnimeDto[],
    source: CacheSource,
  ): Promise<void> {
    const uniqueAnimes = Array.from(
      new Map(animes.map((anime) => [anime.id, anime])).values(),
    );

    if (uniqueAnimes.length === 0) {
      return;
    }

    await Promise.all(
      uniqueAnimes.flatMap((anime) => [
        this.cacheManager.set(
          `anime:${anime.id}:raw:multi:v1`,
          anime,
          this.cacheTtlMs,
        ),
        this.cacheManager.set(
          `anime:item:${anime.id}:multi:v1`,
          anime,
          this.cacheTtlMs,
        ),
      ]),
    );

    try {
      await this.prisma.$transaction(
        uniqueAnimes.flatMap((anime) => [
          this.prismaCacheClient.animeApiCache.upsert({
            where: {
              key: `anime:${anime.id}:raw:multi:v1`,
            },
            create: {
              key: `anime:${anime.id}:raw:multi:v1`,
              payload:
                anime as unknown as Prisma.InputJsonValue,
              source,
            },
            update: {
              payload:
                anime as unknown as Prisma.InputJsonValue,
              source,
            },
          }),
          this.prismaCacheClient.animeApiCache.upsert({
            where: {
              key: `anime:item:${anime.id}:multi:v1`,
            },
            create: {
              key: `anime:item:${anime.id}:multi:v1`,
              payload:
                anime as unknown as Prisma.InputJsonValue,
              source,
            },
            update: {
              payload:
                anime as unknown as Prisma.InputJsonValue,
              source,
            },
          }),
        ]),
      );
    } catch (error) {
      this.logger.warn(
        `No se pudieron persistir snapshots de anime: ${this.getErrorMessage(
          error,
        )}`,
      );
    }
  }

  private async findStoredAnimeById(
    animeId: number,
  ): Promise<AnimeDto | null> {
    const direct = await this.readPersistentCache<AnimeDto>(
      `anime:${animeId}:raw:multi:v1`,
    );

    if (direct?.value) {
      return direct.value;
    }

    const item = await this.readPersistentCache<AnimeDto>(
      `anime:item:${animeId}:multi:v1`,
    );

    return item?.value ?? null;
  }

  private async getStoredAnimeSnapshots(
    limit: number,
  ): Promise<AnimeDto[]> {
    try {
      const rows = await this.prismaCacheClient.animeApiCache.findMany({
        where: {
          key: {
            startsWith: 'anime:item:',
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
        take: Math.min(Math.max(limit, 1), 500),
      });

      const unique = new Map<number, AnimeDto>();

      for (const row of rows) {
        const anime = row.payload as unknown as AnimeDto;

        if (
          anime &&
          typeof anime.id === 'number' &&
          !unique.has(anime.id)
        ) {
          unique.set(anime.id, anime);
        }
      }

      return Array.from(unique.values());
    } catch (error) {
      this.logger.warn(
        `No se pudieron recuperar snapshots persistentes: ${this.getErrorMessage(
          error,
        )}`,
      );

      return [];
    }
  }

  private async searchStoredAnime(
    query: string,
    limit: number,
  ): Promise<AnimeDto[]> {
    const normalized = this.normalizeText(query);
    const snapshots = await this.getStoredAnimeSnapshots(500);

    return snapshots
      .filter((anime) => {
        const text = this.normalizeText(
          `${anime.title} ${anime.originalTitle ?? ''} ${
            anime.synopsis
          } ${anime.genres.map((genre) => genre.name).join(' ')}`,
        );

        return text.includes(normalized);
      })
      .slice(0, limit);
  }

  private getEmergencyCatalog(): AnimeDto[] {
    return AnimeService.EMERGENCY_CATALOG.map((anime) => ({
      ...anime,
      genres: anime.genres.map((genre) => ({ ...genre })),
    }));
  }

  private buildFallbackCulturalNotes(anime: AnimeDto): string[] {
    const notes: string[] = [
      'La información cultural ampliada no pudo actualizarse en este momento. Se muestra la última ficha disponible para mantener el acceso al contenido.',
    ];

    if (anime.releaseYear) {
      notes.push(`Año de estreno registrado: ${anime.releaseYear}.`);
    }

    if (anime.genres.length > 0) {
      notes.push(
        `Géneros asociados: ${anime.genres
          .map((genre) => genre.name)
          .join(', ')}.`,
      );
    }

    return notes;
  }

  private clampLimit(limit: number, max: number): number {
    return Math.min(Math.max(Math.trunc(limit) || 1, 1), max);
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

    if (this.isLikelySpanish(cleanSynopsis)) {
      return cleanSynopsis;
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

  private isLikelySpanish(text: string): boolean {
    const commonSpanishWords =
      /\b(el|la|los|las|un|una|de|del|que|y|en|con|para|por|su|sus|una|como|mientras)\b/gi;

    return (text.match(commonSpanishWords)?.length ?? 0) >= 3;
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