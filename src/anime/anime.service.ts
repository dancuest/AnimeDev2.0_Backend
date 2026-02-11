import { HttpService } from '@nestjs/axios';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cache } from 'cache-manager';
import { lastValueFrom } from 'rxjs';
import { AnimeDetailDto } from './dto/anime-detail.dto';
import { AnimeDto } from './dto/anime.dto';
import { AnimeMapper } from './anime.mapper';
import { JikanAnime, JikanDetailResponse, JikanListResponse } from './types/jikan.types';

@Injectable()
export class AnimeService {
  private readonly baseUrl: string;
  private readonly cacheTtlSeconds: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly mapper: AnimeMapper,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {
    this.baseUrl = this.configService.get<string>('jikanBaseUrl') ??
      'https://api.jikan.moe/v4';
    this.cacheTtlSeconds = this.configService.get<number>('cacheTtlSeconds') ?? 600;
  }

  async getTop(limit = 10, requestId?: string) {
    const cacheKey = `anime:top:${limit}`;
    const data = await this.getCached(cacheKey, async () => {
      const response = await this.fetchList<JikanAnime>('/top/anime', { limit }, requestId);
      return response.data.map((anime) => this.mapper.toAnimeDto(anime));
    });

    return {
      data,
      meta: {
        limit,
      },
    };
  }

  async search(query: string, limit = 10, requestId?: string) {
    const response = await this.fetchList<JikanAnime>(
      '/anime',
      { q: query, limit },
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

  async getById(id: number, requestId?: string): Promise<{ data: AnimeDetailDto }> {
    const cacheKey = `anime:detail:${id}`;
    const anime = await this.getCached(cacheKey, async () => {
      const response = await this.fetchDetail<JikanAnime>(`/anime/${id}`, requestId);
      return this.mapper.toAnimeDto(response.data);
    });

    return {
      data: {
        anime,
        culturalNotes: [],
        trailers: [],
      },
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

  private async fetchDetail<T>(
    endpoint: string,
    requestId?: string,
  ): Promise<JikanDetailResponse<T>> {
    try {
      const response = await lastValueFrom(
        this.httpService.get<JikanDetailResponse<T>>(`${this.baseUrl}${endpoint}`),
      );
      return response.data;
    } catch (error) {
      throw this.buildUpstreamError(error, requestId, endpoint);
    }
  }

  private async getCached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cached = await this.cacheManager.get<T>(key);
    if (cached) {
      return cached;
    }

    const fresh = await fetcher();
    await this.cacheManager.set(key, fresh, { ttl: this.cacheTtlSeconds });
    return fresh;
  }

  private buildUpstreamError(error: unknown, requestId: string | undefined, endpoint: string) {
    const axiosError = error as {
      response?: { status?: number; data?: { message?: string } };
      message?: string;
    };

    const upstreamStatus = axiosError.response?.status ?? null;
    const upstreamMessage =
      axiosError.response?.data?.message ?? axiosError.message ?? 'Unknown error';

    return new HttpException(
      {
        statusCode: HttpStatus.BAD_GATEWAY,
        message: 'Failed to fetch data from upstream provider',
        upstream: {
          status: upstreamStatus,
          message: upstreamMessage,
          endpoint: `${this.baseUrl}${endpoint}`,
        },
        requestId: requestId ?? null,
      },
      HttpStatus.BAD_GATEWAY,
    );
  }
}
