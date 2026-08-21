import { HttpService } from '@nestjs/axios';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';
// Este proveedor conecta el backend con AniList para traer información de anime.
// Sirve como puente entre la API externa y el formato interno que usa el servicio principal del módulo de anime.

import {
  findAnimeGenreById,
  toJikanGenreResource,
} from '../anime-genre.catalog';
import {
  JikanAnime,
  JikanNamedResource,
  JikanRelation,
} from '../types/jikan.types';
import {
  AnimeProviderError,
  AnimeProviderListResult,
} from './anime-provider.types';

interface AniListTitle {
  romaji?: string | null;
  english?: string | null;
  native?: string | null;
}

interface AniListDate {
  year?: number | null;
  month?: number | null;
  day?: number | null;
}

interface AniListMedia {
  id: number;
  idMal?: number | null;
  title?: AniListTitle | null;
  description?: string | null;
  status?: string | null;
  episodes?: number | null;
  duration?: number | null;
  season?: string | null;
  seasonYear?: number | null;
  source?: string | null;
  isAdult?: boolean | null;
  averageScore?: number | null;
  startDate?: AniListDate | null;
  endDate?: AniListDate | null;
  coverImage?: {
    extraLarge?: string | null;
    large?: string | null;
    medium?: string | null;
  } | null;
  trailer?: {
    id?: string | null;
    site?: string | null;
    thumbnail?: string | null;
  } | null;
  genres?: string[] | null;
  tags?: Array<{
    id?: number;
    name?: string | null;
    rank?: number | null;
    isAdult?: boolean | null;
    category?: string | null;
  }> | null;
  studios?: {
    nodes?: Array<{
      id: number;
      name?: string | null;
      siteUrl?: string | null;
    }> | null;
  } | null;
  relations?: {
    edges?: Array<{
      relationType?: string | null;
      node?: {
        id?: number;
        idMal?: number | null;
        type?: string | null;
        title?: AniListTitle | null;
        siteUrl?: string | null;
      } | null;
    }> | null;
  } | null;
}

interface AniListPageInfo {
  total?: number | null;
  perPage?: number | null;
  currentPage?: number | null;
  lastPage?: number | null;
  hasNextPage?: boolean | null;
}

interface AniListGraphQlResponse<T> {
  data?: T;
  errors?: Array<{
    message?: string;
    status?: number;
  }>;
}

interface AniListPagePayload {
  Page?: {
    pageInfo?: AniListPageInfo | null;
    media?: AniListMedia[] | null;
  } | null;
}


// Este archivo implementa un proveedor externo para anime.
// Su trabajo es consultar una fuente de datos y convertirla al formato interno del proyecto.

@Injectable()
export class AniListProvider {
  readonly name = 'anilist' as const;

  private readonly logger = new Logger(AniListProvider.name);
  private readonly baseUrl: string;

  private static readonly TIMEOUT_MS = 10_000;
  private static readonly MAX_ATTEMPTS = 2;
  private static readonly MIN_INTERVAL_MS = 650;
  private static readonly CIRCUIT_BREAK_MS = 90_000;

  private queue: Promise<void> = Promise.resolve();
  private lastRequestAt = 0;
  private circuitOpenUntil = 0;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl =
      this.configService.get<string>('anilistBaseUrl') ??
      'https://graphql.anilist.co';
  }

  // Este método trae los animes más populares desde AniList para alimentar la vista de inicio o las listas destacadas.
  async getTop(
    limit: number,
    includeAdult = false,
  ): Promise<AnimeProviderListResult> {
    const perPage = this.clampLimit(limit, 50);
    const filter = includeAdult ? '' : 'isAdult: false,';

    const query = `
      query ($page: Int!, $perPage: Int!) {
        Page(page: $page, perPage: $perPage) {
          pageInfo {
            total
            perPage
            currentPage
            lastPage
            hasNextPage
          }
          media(
            type: ANIME,
            ${filter}
            sort: [SCORE_DESC, POPULARITY_DESC]
          ) {
            ${this.mediaSelection()}
          }
        }
      }
    `;

    return this.fetchPage(query, { page: 1, perPage }, 'top');
  }

  // Este método busca animes por texto libre, útil cuando el usuario escribe un nombre o parte de un título.
  async search(
    search: string,
    limit: number,
    includeAdult = false,
  ): Promise<AnimeProviderListResult> {
    const perPage = this.clampLimit(limit, 50);
    const filter = includeAdult ? '' : 'isAdult: false,';

    const query = `
      query ($page: Int!, $perPage: Int!, $search: String!) {
        Page(page: $page, perPage: $perPage) {
          pageInfo {
            total
            perPage
            currentPage
            lastPage
            hasNextPage
          }
          media(
            type: ANIME,
            search: $search,
            ${filter}
            sort: [SEARCH_MATCH, POPULARITY_DESC]
          ) {
            ${this.mediaSelection()}
          }
        }
      }
    `;

    return this.fetchPage(
      query,
      { page: 1, perPage, search },
      `search:${search}`,
    );
  }

  // Estos métodos recuperan un anime puntual usando el identificador de MyAnimeList.
  // El primero trae la información básica y el segundo añade relaciones y metadata extra cuando hace falta.
  async getByMalId(id: number): Promise<JikanAnime> {
    return this.fetchSingleByMalId(id, false);
  }

  async getFullByMalId(id: number): Promise<JikanAnime> {
    return this.fetchSingleByMalId(id, true);
  }

  // Este método filtra los resultados por género para que el backend pueda responder consultas más específicas del catálogo.
  async getByGenre(
    genreId: string,
    limit: number,
    includeAdult = false,
  ): Promise<AnimeProviderListResult> {
    const genre = findAnimeGenreById(genreId);

    if (!genre) {
      throw new AnimeProviderError(
        this.name,
        `genre:${genreId}`,
        HttpStatus.BAD_REQUEST,
        `AniList no reconoce el género ${genreId}.`,
      );
    }

    const perPage = this.clampLimit(limit, 50);
    const adultFilter = includeAdult ? '' : 'isAdult: false,';

    const filterArgument = genre.anilistGenre
      ? 'genre_in: $filters,'
      : 'tag_in: $filters,';

    const query = `
      query ($page: Int!, $perPage: Int!, $filters: [String]) {
        Page(page: $page, perPage: $perPage) {
          pageInfo {
            total
            perPage
            currentPage
            lastPage
            hasNextPage
          }
          media(
            type: ANIME,
            ${adultFilter}
            ${filterArgument}
            sort: [POPULARITY_DESC, SCORE_DESC]
          ) {
            ${this.mediaSelection()}
          }
        }
      }
    `;

    const filterValue = genre.anilistGenre ?? genre.anilistTag;

    return this.fetchPage(
      query,
      {
        page: 1,
        perPage,
        filters: filterValue ? [filterValue] : [],
      },
      `genre:${genreId}`,
    );
  }

  // Este método permite resolver varios animes a la vez a partir de una lista de ids, algo útil para cargar lotes de datos de forma más eficiente.
  async getManyByMalIds(ids: number[]): Promise<JikanAnime[]> {
    const uniqueIds = Array.from(
      new Set(ids.filter((id) => Number.isInteger(id) && id > 0)),
    ).slice(0, 50);

    if (uniqueIds.length === 0) {
      return [];
    }

    const query = `
      query ($ids: [Int], $perPage: Int!) {
        Page(page: 1, perPage: $perPage) {
          media(
            type: ANIME,
            idMal_in: $ids,
            sort: [POPULARITY_DESC]
          ) {
            ${this.mediaSelection(false)}
          }
        }
      }
    `;

    const payload = await this.request<AniListPagePayload>(
      query,
      {
        ids: uniqueIds,
        perPage: uniqueIds.length,
      },
      'many-by-mal-id',
    );

    return (payload.Page?.media ?? [])
      .filter((media): media is AniListMedia => Boolean(media?.idMal))
      .map((media) => this.toJikanAnime(media));
  }

  // Este bloque centraliza la llamada a AniList para obtener un anime concreto y convertirlo al formato usado por el proyecto.
  private async fetchSingleByMalId(
    id: number,
    includeRelations: boolean,
  ): Promise<JikanAnime> {
    const query = `
      query ($idMal: Int!) {
        Media(idMal: $idMal, type: ANIME) {
          ${this.mediaSelection(includeRelations)}
        }
      }
    `;

    const payload = await this.request<{ Media?: AniListMedia | null }>(
      query,
      { idMal: id },
      `mal-id:${id}`,
    );

    if (!payload.Media?.idMal) {
      throw new AnimeProviderError(
        this.name,
        `mal-id:${id}`,
        HttpStatus.NOT_FOUND,
        `AniList no encontró el anime con MAL ID ${id}.`,
      );
    }

    return this.toJikanAnime(payload.Media);
  }

  // Este bloque reutiliza la misma consulta para obtener páginas completas de resultados y normalizarlas antes de devolverlas.
  private async fetchPage(
    query: string,
    variables: Record<string, unknown>,
    operation: string,
  ): Promise<AnimeProviderListResult> {
    const payload = await this.request<AniListPagePayload>(
      query,
      variables,
      operation,
    );

    const media = payload.Page?.media ?? [];
    const data = media
      .filter((item): item is AniListMedia => Boolean(item?.idMal))
      .map((item) => this.toJikanAnime(item));

    const pageInfo = payload.Page?.pageInfo;

    return {
      data,
      total: pageInfo?.total ?? data.length,
      count: data.length,
      hasNextPage: pageInfo?.hasNextPage ?? false,
    };
  }

  private mediaSelection(includeRelations = true): string {
    return `
      id
      idMal
      title {
        romaji
        english
        native
      }
      description(asHtml: false)
      status
      episodes
      duration
      season
      seasonYear
      source(version: 3)
      isAdult
      averageScore
      startDate {
        year
        month
        day
      }
      endDate {
        year
        month
        day
      }
      coverImage {
        extraLarge
        large
        medium
      }
      trailer {
        id
        site
        thumbnail
      }
      genres
      tags {
        id
        name
        rank
        isAdult
        category
      }
      studios(isMain: true) {
        nodes {
          id
          name
          siteUrl
        }
      }
      ${
        includeRelations
          ? `
      relations {
        edges {
          relationType(version: 2)
          node {
            id
            idMal
            type
            title {
              romaji
              english
              native
            }
            siteUrl
          }
        }
      }
      `
          : ''
      }
    `;
  }

  // Este método maneja la comunicación real con AniList, incluyendo reintentos, throttling y manejo de errores de red o GraphQL.
  private async request<T>(
    query: string,
    variables: Record<string, unknown>,
    operation: string,
  ): Promise<T> {
    if (Date.now() < this.circuitOpenUntil) {
      throw new AnimeProviderError(
        this.name,
        operation,
        null,
        'El circuito de AniList está temporalmente abierto.',
        this.circuitOpenUntil - Date.now(),
      );
    }

    let lastError: unknown;

    for (
      let attempt = 1;
      attempt <= AniListProvider.MAX_ATTEMPTS;
      attempt += 1
    ) {
      try {
        const response = await this.enqueue(async () =>
          lastValueFrom(
            this.httpService.post<AniListGraphQlResponse<T>>(
              this.baseUrl,
              { query, variables },
              {
                timeout: AniListProvider.TIMEOUT_MS,
                headers: {
                  Accept: 'application/json',
                  'Content-Type': 'application/json',
                },
              },
            ),
          ),
        );

        const graphQlErrors = response.data.errors ?? [];

        if (graphQlErrors.length > 0) {
          const first = graphQlErrors[0];

          throw new AnimeProviderError(
            this.name,
            operation,
            first.status ?? response.status,
            first.message ?? 'AniList devolvió un error GraphQL.',
          );
        }

        if (!response.data.data) {
          throw new AnimeProviderError(
            this.name,
            operation,
            response.status,
            'AniList devolvió una respuesta sin datos.',
          );
        }

        this.circuitOpenUntil = 0;
        return response.data.data;
      } catch (error) {
        lastError = error;
        const status = this.getStatus(error);
        const retryable =
          status === null ||
          status === HttpStatus.TOO_MANY_REQUESTS ||
          status >= HttpStatus.INTERNAL_SERVER_ERROR;

        if (!retryable || attempt === AniListProvider.MAX_ATTEMPTS) {
          if (retryable) {
            this.circuitOpenUntil =
              Date.now() + AniListProvider.CIRCUIT_BREAK_MS;
          }
          break;
        }

        const waitMs = this.getRetryDelayMs(error, attempt);

        this.logger.warn(
          `AniList falló en ${operation}. status=${status ?? 'network'}, ` +
            `intento=${attempt}/${AniListProvider.MAX_ATTEMPTS}. ` +
            `Reintento en ${waitMs}ms.`,
        );

        await this.sleep(waitMs);
      }
    }

    throw this.toProviderError(lastError, operation);
  }

  private enqueue<T>(request: () => Promise<T>): Promise<T> {
    const task = this.queue.then(async () => {
      const waitMs = Math.max(
        0,
        this.lastRequestAt + AniListProvider.MIN_INTERVAL_MS - Date.now(),
      );

      if (waitMs > 0) {
        await this.sleep(waitMs);
      }

      this.lastRequestAt = Date.now();
      return request();
    });

    this.queue = task.then(
      () => undefined,
      () => undefined,
    );

    return task;
  }

  // Este método transforma la respuesta cruda de AniList al modelo interno del proyecto, preparando títulos, géneros, imágenes y relaciones.
  private toJikanAnime(media: AniListMedia): JikanAnime {
    const genres = this.toNamedResources([
      ...(media.genres ?? []),
      ...(media.tags ?? [])
        .filter((tag) => !tag.isAdult && (tag.rank ?? 0) >= 60)
        .map((tag) => tag.name ?? ''),
    ]);

    const themes = this.toNamedResources(
      (media.tags ?? [])
        .filter(
          (tag) =>
            !tag.isAdult &&
            (tag.rank ?? 0) >= 60 &&
            !['Demographic', 'Genre'].includes(tag.category ?? ''),
        )
        .map((tag) => tag.name ?? ''),
    );

    const demographics = this.toNamedResources(
      (media.tags ?? [])
        .map((tag) => tag.name ?? '')
        .filter((name) =>
          ['Shounen', 'Shoujo', 'Seinen', 'Josei', 'Kids'].includes(name),
        ),
    );

    const relations: JikanRelation[] = (media.relations?.edges ?? [])
      .map((edge) => {
        const node = edge.node;
        const malId = node?.idMal;

        if (!node || !malId || !node.type) {
          return null;
        }

        const relation = this.mapRelationType(edge.relationType);
        const title =
          node.title?.english ??
          node.title?.romaji ??
          node.title?.native ??
          `Media ${malId}`;

        return {
          relation,
          entry: [
            {
              mal_id: malId,
              type: node.type.toLowerCase(),
              name: title,
              url: node.siteUrl ?? `https://anilist.co/${node.type.toLowerCase()}/${node.id}`,
            },
          ],
        } satisfies JikanRelation;
      })
      .filter((value): value is JikanRelation => Boolean(value));

    const title =
      media.title?.english ??
      media.title?.romaji ??
      media.title?.native ??
      `Anime ${media.idMal}`;

    const cover =
      media.coverImage?.extraLarge ??
      media.coverImage?.large ??
      media.coverImage?.medium ??
      '';

    const airedString = this.formatDateRange(media.startDate, media.endDate);

    const youtubeId =
      media.trailer?.site?.toLowerCase() === 'youtube'
        ? media.trailer.id ?? null
        : null;

    return {
      mal_id: Number(media.idMal),
      title,
      title_english: media.title?.english ?? null,
      title_japanese: media.title?.native ?? media.title?.romaji ?? null,
      synopsis: this.stripMarkup(media.description ?? ''),
      images: {
        jpg: {
          image_url: cover,
          large_image_url: cover,
        },
        webp: {
          image_url: cover,
          large_image_url: cover,
        },
      },
      status: this.mapStatus(media.status),
      airing: media.status === 'RELEASING',
      episodes: media.episodes ?? null,
      duration: media.duration ? `${media.duration} min per ep` : null,
      score:
        typeof media.averageScore === 'number'
          ? media.averageScore / 10
          : null,
      year: media.seasonYear ?? media.startDate?.year ?? null,
      season: media.season?.toLowerCase() ?? null,
      source: this.mapSource(media.source),
      aired: {
        from: this.toIsoDate(media.startDate),
        to: this.toIsoDate(media.endDate),
        string: airedString,
      },
      genres,
      themes,
      demographics,
      studios: (media.studios?.nodes ?? [])
        .filter((studio) => Boolean(studio.name))
        .map((studio) => ({
          mal_id: studio.id,
          name: studio.name ?? '',
          url: studio.siteUrl ?? undefined,
        })),
      trailer: youtubeId
        ? {
            youtube_id: youtubeId,
            url: `https://www.youtube.com/watch?v=${youtubeId}`,
            embed_url: `https://www.youtube.com/embed/${youtubeId}`,
          }
        : undefined,
      relations,
    };
  }

  private toNamedResources(names: string[]): JikanNamedResource[] {
    const unique = new Map<number, JikanNamedResource>();

    for (const name of names) {
      if (!name.trim()) {
        continue;
      }

      const resource = toJikanGenreResource(name);

      if (!resource) {
        continue;
      }

      unique.set(resource.mal_id, {
        mal_id: resource.mal_id,
        name: resource.name,
      });
    }

    return Array.from(unique.values());
  }

  private mapRelationType(value?: string | null): string {
    const normalized = value?.toUpperCase() ?? '';

    const relationMap: Record<string, string> = {
      PREQUEL: 'Prequel',
      SEQUEL: 'Sequel',
      SOURCE: 'Adaptation',
      ADAPTATION: 'Adaptation',
      SIDE_STORY: 'Side Story',
      PARENT: 'Parent Story',
      CHARACTER: 'Character',
      SUMMARY: 'Summary',
      ALTERNATIVE: 'Alternative Version',
      SPIN_OFF: 'Spin-Off',
      OTHER: 'Other',
    };

    return relationMap[normalized] ?? value ?? 'Other';
  }

  private mapStatus(status?: string | null): string | null {
    const statusMap: Record<string, string> = {
      FINISHED: 'Finished Airing',
      RELEASING: 'Currently Airing',
      NOT_YET_RELEASED: 'Not yet aired',
      CANCELLED: 'Cancelled',
      HIATUS: 'On Break',
    };

    return status ? statusMap[status] ?? status : null;
  }

  private mapSource(source?: string | null): string | null {
    const sourceMap: Record<string, string> = {
      ORIGINAL: 'Original',
      MANGA: 'Manga',
      LIGHT_NOVEL: 'Light novel',
      VISUAL_NOVEL: 'Visual novel',
      VIDEO_GAME: 'Game',
      OTHER: 'Other',
      NOVEL: 'Novel',
      DOUJINSHI: 'Doujinshi',
      ANIME: 'Anime',
      WEB_NOVEL: 'Web novel',
      LIVE_ACTION: 'Live action',
      GAME: 'Game',
      COMIC: 'Comic',
      MULTIMEDIA_PROJECT: 'Multimedia project',
      PICTURE_BOOK: 'Picture book',
    };

    return source ? sourceMap[source] ?? source : null;
  }

  private formatDateRange(
    start?: AniListDate | null,
    end?: AniListDate | null,
  ): string | null {
    const startText = this.formatDate(start);
    const endText = this.formatDate(end);

    if (startText && endText) {
      return `${startText} a ${endText}`;
    }

    return startText ?? endText;
  }

  private formatDate(date?: AniListDate | null): string | null {
    if (!date?.year) {
      return null;
    }

    const month = date.month ? String(date.month).padStart(2, '0') : '01';
    const day = date.day ? String(date.day).padStart(2, '0') : '01';

    return `${date.year}-${month}-${day}`;
  }

  private toIsoDate(date?: AniListDate | null): string | null {
    return this.formatDate(date);
  }

  private stripMarkup(value: string): string {
    return value
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/~!/g, '')
      .replace(/!~/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private clampLimit(limit: number, max: number): number {
    return Math.min(Math.max(Math.trunc(limit) || 1, 1), max);
  }

  private toProviderError(
    error: unknown,
    operation: string,
  ): AnimeProviderError {
    if (error instanceof AnimeProviderError) {
      return error;
    }

    const status = this.getStatus(error);
    const axiosError = error as {
      message?: string;
      response?: {
        data?: {
          errors?: Array<{ message?: string }>;
          message?: string;
        };
      };
    };

    const message =
      axiosError.response?.data?.errors?.[0]?.message ??
      axiosError.response?.data?.message ??
      axiosError.message ??
      `AniList falló en ${operation}.`;

    return new AnimeProviderError(this.name, operation, status, message);
  }

  private getStatus(error: unknown): number | null {
    if (error instanceof AnimeProviderError) {
      return error.upstreamStatus;
    }

    const status = (error as { response?: { status?: number } })?.response
      ?.status;

    return typeof status === 'number' ? status : null;
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
      const seconds = Number(retryAfter);

      if (Number.isFinite(seconds) && seconds >= 0) {
        return Math.max(1_000, Math.ceil(seconds * 1_000));
      }
    }

    return attempt * 1_000;
  }

  private sleep(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
}
