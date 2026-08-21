import { HttpService } from '@nestjs/axios';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';
// Este archivo pertenece al módulo de anime y se encarga de manejar la información de los animes, ya sea para listarlos, filtrarlos o enriquecerlos.


import {
  findAnimeGenreById,
  toJikanGenreResource,
} from '../anime-genre.catalog';
import {
  JikanAnime,
  JikanNamedResource,
} from '../types/jikan.types';
import {
  AnimeProviderError,
  AnimeProviderListResult,
} from './anime-provider.types';

interface KitsuResourceIdentifier {
  id: string;
  type: string;
}

interface KitsuRelationship {
  data?: KitsuResourceIdentifier | KitsuResourceIdentifier[] | null;
  links?: {
    related?: string;
  };
}

interface KitsuResource {
  id: string;
  type: string;
  attributes?: Record<string, unknown>;
  relationships?: Record<string, KitsuRelationship>;
}

interface KitsuResponse {
  data: KitsuResource | KitsuResource[];
  included?: KitsuResource[];
  links?: {
    next?: string | null;
  };
  meta?: {
    count?: number;
  };
}


// Este archivo implementa un proveedor externo para anime.
// Su trabajo es consultar una fuente de datos y convertirla al formato interno del proyecto.

@Injectable()
export class KitsuProvider {
  readonly name = 'kitsu' as const;

  private readonly logger = new Logger(KitsuProvider.name);
  private readonly baseUrl: string;

  private static readonly TIMEOUT_MS = 9_000;
  private static readonly MAX_ATTEMPTS = 2;
  private static readonly CIRCUIT_BREAK_MS = 90_000;
  private static readonly MIN_INTERVAL_MS = 350;

  private queue: Promise<void> = Promise.resolve();
  private lastRequestAt = 0;
  private circuitOpenUntil = 0;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl =
      this.configService.get<string>('kitsuBaseUrl') ??
      'https://kitsu.io/api/edge';
  }

  async getTop(
    limit: number,
    includeAdult = false,
  ): Promise<AnimeProviderListResult> {
    const response = await this.request(
      '/anime',
      {
        'page[limit]': this.clampLimit(limit, 20),
        'page[offset]': 0,
        sort: '-userCount,-averageRating',
        include: 'categories,mappings',
      },
      'top',
    );

    return this.toListResult(response, includeAdult);
  }

  async search(
    query: string,
    limit: number,
    includeAdult = false,
  ): Promise<AnimeProviderListResult> {
    const response = await this.request(
      '/anime',
      {
        'filter[text]': query,
        'page[limit]': this.clampLimit(limit, 20),
        'page[offset]': 0,
        sort: '-userCount',
        include: 'categories,mappings',
      },
      `search:${query}`,
    );

    return this.toListResult(response, includeAdult);
  }

  async getByGenre(
    genreId: string,
    limit: number,
    includeAdult = false,
  ): Promise<AnimeProviderListResult> {
    const genre = findAnimeGenreById(genreId);

    if (!genre?.kitsuSlug) {
      throw new AnimeProviderError(
        this.name,
        `genre:${genreId}`,
        HttpStatus.BAD_REQUEST,
        `Kitsu no reconoce el género ${genreId}.`,
      );
    }

    const response = await this.request(
      '/anime',
      {
        'filter[categories]': genre.kitsuSlug,
        'page[limit]': this.clampLimit(limit, 20),
        'page[offset]': 0,
        sort: '-userCount,-averageRating',
        include: 'categories,mappings',
      },
      `genre:${genreId}`,
    );

    return this.toListResult(response, includeAdult);
  }

  async getByMalId(id: number): Promise<JikanAnime> {
    return this.resolveByMalId(id);
  }

  async getFullByMalId(id: number): Promise<JikanAnime> {
    return this.resolveByMalId(id);
  }

  private async resolveByMalId(id: number): Promise<JikanAnime> {
    const externalSites = ['myanimelist/anime', 'myanimelist'];

    for (const externalSite of externalSites) {
      try {
        const mappingResponse = await this.request(
          '/mappings',
          {
            'filter[externalSite]': externalSite,
            'filter[externalId]': String(id),
            'page[limit]': 1,
            include: 'item',
          },
          `mapping:${id}:${externalSite}`,
        );

        const mappingRows = this.asArray(mappingResponse.data);
        const included = mappingResponse.included ?? [];

        const animeFromInclude = included.find(
          (resource) => resource.type === 'anime',
        );

        const itemReference = mappingRows
          .map((row) => row.relationships?.item?.data)
          .find(
            (value): value is KitsuResourceIdentifier =>
              Boolean(
                value &&
                  !Array.isArray(value) &&
                  value.type === 'anime' &&
                  value.id,
              ),
          );

        const kitsuId = animeFromInclude?.id ?? itemReference?.id;

        if (!kitsuId) {
          continue;
        }

        const animeResponse = await this.request(
          `/anime/${kitsuId}`,
          {
            include: 'categories,mappings',
          },
          `anime:${kitsuId}`,
        );

        const animeResource = this.asArray(animeResponse.data)[0];

        if (!animeResource) {
          continue;
        }

        const mappedAnime = this.toJikanAnime(
          animeResource,
          animeResponse.included ?? [],
          id,
        );

        if (mappedAnime) {
          return mappedAnime;
        }
      } catch (error) {
        if (
          error instanceof AnimeProviderError &&
          error.upstreamStatus === HttpStatus.NOT_FOUND
        ) {
          continue;
        }

        throw error;
      }
    }

    throw new AnimeProviderError(
      this.name,
      `mal-id:${id}`,
      HttpStatus.NOT_FOUND,
      `Kitsu no encontró el anime con MAL ID ${id}.`,
    );
  }

  private toListResult(
    response: KitsuResponse,
    includeAdult: boolean,
  ): AnimeProviderListResult {
    const resources = this.asArray(response.data);
    const included = response.included ?? [];

    const data = resources
      .map((resource) => this.toJikanAnime(resource, included))
      .filter((anime): anime is JikanAnime => Boolean(anime))
      .filter((anime) => {
        if (includeAdult) {
          return true;
        }

        return !anime.genres?.some((genre) =>
          [9, 12, 49].includes(genre.mal_id),
        );
      });

    return {
      data,
      total: response.meta?.count ?? data.length,
      count: data.length,
      hasNextPage: Boolean(response.links?.next),
    };
  }

  private toJikanAnime(
    resource: KitsuResource,
    included: KitsuResource[],
    forcedMalId?: number,
  ): JikanAnime | null {
    if (resource.type !== 'anime') {
      return null;
    }

    const attributes = resource.attributes ?? {};
    const malId =
      forcedMalId ?? this.findMalId(resource, included) ?? undefined;

    if (!malId) {
      return null;
    }

    const titles = this.asRecord(attributes.titles);
    const posterImage = this.asRecord(attributes.posterImage);
    const canonicalTitle = this.asString(attributes.canonicalTitle);
    const englishTitle =
      this.asString(titles.en) ??
      this.asString(titles.en_us) ??
      canonicalTitle ??
      this.asString(titles.en_jp);
    const romajiTitle =
      this.asString(titles.en_jp) ?? canonicalTitle ?? englishTitle;
    const japaneseTitle = this.asString(titles.ja_jp);
    const title =
      englishTitle ?? romajiTitle ?? japaneseTitle ?? `Anime ${malId}`;

    const cover =
      this.asString(posterImage.original) ??
      this.asString(posterImage.large) ??
      this.asString(posterImage.medium) ??
      this.asString(posterImage.small) ??
      '';

    const startDate = this.asString(attributes.startDate);
    const endDate = this.asString(attributes.endDate);
    const episodeLength = this.asNumber(attributes.episodeLength);
    const youtubeVideoId = this.asString(attributes.youtubeVideoId);

    const genres = this.resolveCategories(resource, included);

    return {
      mal_id: malId,
      title,
      title_english: englishTitle ?? null,
      title_japanese: japaneseTitle ?? romajiTitle ?? null,
      synopsis:
        this.asString(attributes.synopsis) ??
        this.asString(attributes.description) ??
        '',
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
      status: this.mapStatus(this.asString(attributes.status)),
      airing: this.asString(attributes.status) === 'current',
      episodes: this.asNumber(attributes.episodeCount),
      duration: episodeLength ? `${episodeLength} min per ep` : null,
      score: this.toScore(this.asString(attributes.averageRating)),
      rating: this.asString(attributes.ageRating),
      year: this.extractYear(startDate),
      aired: {
        from: startDate ?? null,
        to: endDate ?? null,
        string: this.formatDateRange(startDate, endDate),
      },
      genres,
      themes: genres,
      demographics: [],
      trailer: youtubeVideoId
        ? {
            youtube_id: youtubeVideoId,
            url: `https://www.youtube.com/watch?v=${youtubeVideoId}`,
            embed_url: `https://www.youtube.com/embed/${youtubeVideoId}`,
          }
        : undefined,
      relations: [],
    };
  }

  private findMalId(
    resource: KitsuResource,
    included: KitsuResource[],
  ): number | null {
    const mappingIds = this.asIdentifiers(
      resource.relationships?.mappings?.data,
    );

    const mappings = included.filter(
      (includedResource) =>
        includedResource.type === 'mappings' &&
        mappingIds.some((identifier) => identifier.id === includedResource.id),
    );

    for (const mapping of mappings) {
      const attributes = mapping.attributes ?? {};
      const externalSite =
        this.asString(attributes.externalSite)?.toLowerCase() ?? '';
      const externalId = this.asString(attributes.externalId);

      if (
        externalId &&
        (externalSite.includes('myanimelist/anime') ||
          externalSite === 'myanimelist')
      ) {
        const numericId = Number(externalId);

        if (Number.isInteger(numericId) && numericId > 0) {
          return numericId;
        }
      }
    }

    return null;
  }

  private resolveCategories(
    resource: KitsuResource,
    included: KitsuResource[],
  ): JikanNamedResource[] {
    const categoryIdentifiers = this.asIdentifiers(
      resource.relationships?.categories?.data,
    );

    const resources = included.filter(
      (includedResource) =>
        ['categories', 'genres'].includes(includedResource.type) &&
        categoryIdentifiers.some(
          (identifier) => identifier.id === includedResource.id,
        ),
    );

    const unique = new Map<number, JikanNamedResource>();

    for (const category of resources) {
      const attributes = category.attributes ?? {};
      const title =
        this.asString(attributes.title) ??
        this.asString(attributes.name) ??
        this.asString(attributes.slug);

      if (!title) {
        continue;
      }

      const genre = toJikanGenreResource(title);

      if (!genre) {
        continue;
      }

      unique.set(genre.mal_id, {
        mal_id: genre.mal_id,
        name: genre.name,
      });
    }

    return Array.from(unique.values());
  }

  private async request(
    endpoint: string,
    params: Record<string, unknown>,
    operation: string,
  ): Promise<KitsuResponse> {
    if (Date.now() < this.circuitOpenUntil) {
      throw new AnimeProviderError(
        this.name,
        operation,
        null,
        'El circuito de Kitsu está temporalmente abierto.',
        this.circuitOpenUntil - Date.now(),
      );
    }

    let lastError: unknown;

    for (
      let attempt = 1;
      attempt <= KitsuProvider.MAX_ATTEMPTS;
      attempt += 1
    ) {
      try {
        const response = await this.enqueue(async () =>
          lastValueFrom(
            this.httpService.get<KitsuResponse>(
              `${this.baseUrl}${endpoint}`,
              {
                params,
                timeout: KitsuProvider.TIMEOUT_MS,
                headers: {
                  Accept: 'application/vnd.api+json',
                  'Content-Type': 'application/vnd.api+json',
                },
              },
            ),
          ),
        );

        this.circuitOpenUntil = 0;
        return response.data;
      } catch (error) {
        lastError = error;
        const status = this.getStatus(error);
        const retryable =
          status === null ||
          status === HttpStatus.TOO_MANY_REQUESTS ||
          status >= HttpStatus.INTERNAL_SERVER_ERROR;

        if (!retryable || attempt === KitsuProvider.MAX_ATTEMPTS) {
          if (retryable) {
            this.circuitOpenUntil =
              Date.now() + KitsuProvider.CIRCUIT_BREAK_MS;
          }
          break;
        }

        const waitMs = attempt * 1_000;

        this.logger.warn(
          `Kitsu falló en ${operation}. status=${status ?? 'network'}, ` +
            `intento=${attempt}/${KitsuProvider.MAX_ATTEMPTS}. ` +
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
        this.lastRequestAt + KitsuProvider.MIN_INTERVAL_MS - Date.now(),
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
          errors?: Array<{
            title?: string;
            detail?: string;
          }>;
        };
      };
    };

    const firstError = axiosError.response?.data?.errors?.[0];
    const message =
      firstError?.detail ??
      firstError?.title ??
      axiosError.message ??
      `Kitsu falló en ${operation}.`;

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

  private mapStatus(status?: string | null): string | null {
    const map: Record<string, string> = {
      current: 'Currently Airing',
      finished: 'Finished Airing',
      tba: 'Not yet aired',
      unreleased: 'Not yet aired',
      upcoming: 'Not yet aired',
    };

    return status ? map[status] ?? status : null;
  }

  private toScore(value: string | null): number | null {
    if (!value) {
      return null;
    }

    const numeric = Number(value);

    if (!Number.isFinite(numeric)) {
      return null;
    }

    return numeric / 10;
  }

  private formatDateRange(
    start: string | null,
    end: string | null,
  ): string | null {
    if (start && end) {
      return `${start} a ${end}`;
    }

    return start ?? end;
  }

  private extractYear(value: string | null): number | null {
    if (!value) {
      return null;
    }

    const match = /^(\d{4})/.exec(value);
    return match ? Number(match[1]) : null;
  }

  private asArray(
    value: KitsuResource | KitsuResource[],
  ): KitsuResource[] {
    return Array.isArray(value) ? value : value ? [value] : [];
  }

  private asIdentifiers(
    value:
      | KitsuResourceIdentifier
      | KitsuResourceIdentifier[]
      | null
      | undefined,
  ): KitsuResourceIdentifier[] {
    if (!value) {
      return [];
    }

    return Array.isArray(value) ? value : [value];
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private asString(value: unknown): string | null {
    return typeof value === 'string' && value.trim()
      ? value.trim()
      : null;
  }

  private asNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value)
      ? value
      : null;
  }

  private clampLimit(limit: number, max: number): number {
    return Math.min(Math.max(Math.trunc(limit) || 1, 1), max);
  }

  private sleep(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
}
