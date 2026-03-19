import { HttpService } from '@nestjs/axios';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cache } from 'cache-manager';
import { lastValueFrom } from 'rxjs';
import { AnimeDetailDto, TrailerDto } from './dto/anime-detail.dto';
import { AnimeDto, GenreDto } from './dto/anime.dto';
import { AnimeMapper } from './anime.mapper';
import { JikanAnime, JikanDetailResponse, JikanListResponse } from './types/jikan.types';

@Injectable()
export class AnimeService {
  private readonly baseUrl: string;
  private readonly cacheTtlMs: number;
  private readonly shortCacheTtlMs: number;
  private static readonly ADULT_GENRE_IDS = new Set(['9', '12', '49']);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly mapper: AnimeMapper,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {
    this.baseUrl = this.configService.get<string>('jikanBaseUrl') ?? 'https://api.jikan.moe/v4';
    this.cacheTtlMs = this.configService.get('cacheTtlMs') ?? 600_000;
    this.shortCacheTtlMs = this.configService.get('shortCacheTtlMs') ?? 60_000;
  }

  /**
   * If includeAdult !== true -> enforce sfw=true upstream (Jikan)
   */
  private withSfw(
    params: Record<string, string | number | boolean | undefined>,
    includeAdult?: boolean,
  ) {
    if (includeAdult === true) return params;
    return { ...params, sfw: true };
  }

  async getTop(limit = 10, requestId?: string, includeAdult?: boolean) {
    const cacheKey = `anime:top:${limit}:${includeAdult === true ? 'all' : 'sfw'}`;
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
      meta: {
        limit,
      },
    };
  }

  async search(query: string, limit = 10, requestId?: string, includeAdult?: boolean) {
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
  }

  async getById(id: number, requestId?: string): Promise<{ data: AnimeDto }> {
    const cacheKey = `anime:${id}`;
    const anime = await this.getCached(cacheKey, async () => {
      const response = await this.fetchDetail<JikanAnime>(`/anime/${id}`, requestId);
      return this.mapper.toAnimeDto(response.data);
    });

    return {
      data: anime,
    };
  }

  async getDetail(id: number, requestId?: string): Promise<{ data: AnimeDetailDto }> {
    const cacheKey = `anime:detail:${id}`;
    const detail = await this.getCached(cacheKey, async () => {
      const response = await this.fetchDetail<JikanAnime>(`/anime/${id}`, requestId);
      const anime = this.mapper.toAnimeDto(response.data);
      return {
        anime,
        culturalNotes: this.buildCulturalNotes(anime, response.data),
        trailers: this.buildTrailers(anime),
      };
    });

    return {
      data: detail,
    };
  }

  async getHero(requestId?: string): Promise<{ data: AnimeDto }> {
    const cacheKey = 'anime:hero';
    const anime = await this.getCached(
      cacheKey,
      async () => {
        const response = await this.fetchList<JikanAnime>(
          '/top/anime',
          this.withSfw({ limit: 10 }, false),
          requestId,
        );
        const items = response.data.map((item) => this.mapper.toAnimeDto(item));
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
        return items[Math.floor(Math.random() * items.length)];
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
    const response = await this.fetchList<JikanAnime>(
      '/anime',
      this.withSfw({ genres: genreId, limit }, includeAdult),
      requestId,
    );

    return {
      data: response.data.map((anime) => this.mapper.toAnimeDto(anime)),
      meta: {
        limit,
      },
    };
  }

  async getGenres(includeAdult = true, requestId?: string): Promise<{ data: GenreDto[] }> {
    const cacheKey = `anime:genres:${includeAdult ? 'all' : 'safe'}`;
    const genres = await this.getCached(
      cacheKey,
      async () => {
        const response = await this.fetchList<{ mal_id: number; name: string }>(
          '/genres/anime',
          {},
          requestId,
        );
        const mappedGenres = response.data.map((genre) => this.mapper.toGenreDto(genre));
        if (includeAdult) return mappedGenres;
        return mappedGenres.filter((genre) => !AnimeService.ADULT_GENRE_IDS.has(genre.id));
      },
      this.shortCacheTtlMs,
    );

    return {
      data: genres,
    };
  }

  private async fetchList<T>(
    endpoint: string,
    params: Record<string, string | number | boolean | undefined>,
    requestId?: string,
  ): Promise<JikanListResponse<T>> {
    try {
      const response = await lastValueFrom(
        this.httpService.get<JikanListResponse<T>>(`${this.baseUrl}${endpoint}`, { params }),
      );
      return response.data;
    } catch (error) {
      throw this.buildUpstreamError(error, requestId, endpoint);
    }
  }

  private async fetchDetail<T>(endpoint: string, requestId?: string): Promise<JikanDetailResponse<T>> {
    try {
      const response = await lastValueFrom(
        this.httpService.get<JikanDetailResponse<T>>(`${this.baseUrl}${endpoint}`),
      );
      return response.data;
    } catch (error) {
      throw this.buildUpstreamError(error, requestId, endpoint);
    }
  }

  private async getCached<T>(key: string, fetcher: () => Promise<T>, ttlMs = this.cacheTtlMs): Promise<T> {
    const cached = await this.cacheManager.get<T>(key);
    if (cached !== undefined && cached !== null) return cached;

    const fresh = await fetcher();
    await this.cacheManager.set(key, fresh, ttlMs);
    return fresh;
  }

  private buildUpstreamError(error: unknown, requestId: string | undefined, endpoint: string) {
    const axiosError = error as {
      response?: { status?: number; data?: { message?: string; error?: string } };
      message?: string;
      code?: string;
    };

    const upstreamStatus = axiosError.response?.status;
    const statusCode =
      upstreamStatus && upstreamStatus >= 500 ? HttpStatus.SERVICE_UNAVAILABLE : HttpStatus.BAD_GATEWAY;

    const upstreamMessage = axiosError.response?.data?.message ?? axiosError.response?.data?.error;
    const fallbackMessage = `Jikan upstream request failed at ${endpoint}`;

    return new HttpException(
      {
        error: {
          code: 'UPSTREAM_FAILURE',
          message: upstreamMessage ?? axiosError.message ?? fallbackMessage,
          requestId: requestId ?? null,
        },
      },
      statusCode,
    );
  }

  private buildCulturalNotes(anime: AnimeDto, source: JikanAnime): string[] {
    const notes: string[] = [];
    if (anime.releaseYear) {
      notes.push(`Estrenado en ${anime.releaseYear}.`);
    }
    if (source.season) {
      notes.push(`Temporada original: ${source.season}.`);
    }
    if (source.studios && source.studios.length > 0) {
      const studioNames = source.studios.slice(0, 2).map((studio) => studio.name).join(', ');
      notes.push(`Producción a cargo de ${studioNames}.`);
    }
    if (anime.genres.length > 0) {
      const genreNames = anime.genres.slice(0, 3).map((genre) => genre.name).join(', ');
      notes.push(`Combina elementos de ${genreNames}.`);
    }
    notes.push('Ideal para explorar nuevas tendencias del anime.');
    notes.push('Recomendado para fans que buscan historias memorables.');
    return notes.slice(0, 4);
  }

  private buildTrailers(anime: AnimeDto): TrailerDto[] {
    const base = anime.title.trim() || 'anime trailer';
    const variants = [`${base} trailer`, `${base} PV`, `${base} opening`, `${base} teaser`];

    return variants.slice(0, 4).map((query, index) => ({
      number: index + 1,
      title: query,
      durationMinutes: 2 + index,
      description: `Búsqueda sugerida para ${anime.title}.`,
      youtubeUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
    }));
  }
}
