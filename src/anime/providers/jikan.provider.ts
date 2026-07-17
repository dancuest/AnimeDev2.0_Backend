import { HttpService } from '@nestjs/axios';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';

import {
  JikanAnime,
  JikanDetailResponse,
  JikanListResponse,
} from '../types/jikan.types';
import {
  AnimeProviderError,
  AnimeProviderListResult,
} from './anime-provider.types';

@Injectable()
export class JikanProvider {
  readonly name = 'jikan' as const;

  private readonly logger = new Logger(JikanProvider.name);
  private readonly baseUrl: string;

  private static readonly MIN_INTERVAL_MS = 400;
  private static readonly WINDOW_MS = 60_000;
  private static readonly MAX_REQUESTS_PER_WINDOW = 60;
  private static readonly MAX_ATTEMPTS = 2;
  private static readonly TIMEOUT_MS = 8_000;
  private static readonly CIRCUIT_BREAK_MS = 120_000;

  private queue: Promise<void> = Promise.resolve();
  private readonly requestTimestamps: number[] = [];
  private circuitOpenUntil = 0;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl =
      this.configService.get<string>('jikanBaseUrl') ??
      'https://api.jikan.moe/v4';
  }

  async getTop(
    limit: number,
    includeAdult = false,
  ): Promise<AnimeProviderListResult> {
    return this.getList('/top/anime', this.withSfw({ limit }, includeAdult));
  }

  async search(
    query: string,
    limit: number,
    includeAdult = false,
  ): Promise<AnimeProviderListResult> {
    return this.getList(
      '/anime',
      this.withSfw({ q: query, limit }, includeAdult),
    );
  }

  async getByMalId(id: number): Promise<JikanAnime> {
    const response = await this.getDetail<JikanAnime>(`/anime/${id}`);
    return response.data;
  }

  async getFullByMalId(id: number): Promise<JikanAnime> {
    const response = await this.getDetail<JikanAnime>(`/anime/${id}/full`);
    return response.data;
  }

  async getByGenre(
    genreId: string,
    limit: number,
    includeAdult = false,
  ): Promise<AnimeProviderListResult> {
    return this.getList(
      '/anime',
      this.withSfw({ genres: genreId, limit }, includeAdult),
    );
  }

  async getGenres(): Promise<Array<{ mal_id: number; name: string }>> {
    const response = await this.getListRaw<{
      mal_id: number;
      name: string;
    }>('/genres/anime', {});

    return response.data;
  }

  private withSfw(
    params: Record<string, unknown>,
    includeAdult: boolean,
  ): Record<string, unknown> {
    return includeAdult ? params : { ...params, sfw: true };
  }

  private async getList(
    endpoint: string,
    params: Record<string, unknown>,
  ): Promise<AnimeProviderListResult> {
    const response = await this.getListRaw<JikanAnime>(endpoint, params);
    const count = response.pagination?.items?.count ?? response.data.length;

    return {
      data: response.data,
      total: response.pagination?.items?.total ?? count,
      count,
      hasNextPage: response.pagination?.has_next_page ?? false,
    };
  }

  private async getListRaw<T>(
    endpoint: string,
    params: Record<string, unknown>,
  ): Promise<JikanListResponse<T>> {
    return this.execute(
      endpoint,
      async () => {
        const response = await lastValueFrom(
          this.httpService.get<JikanListResponse<T>>(
            `${this.baseUrl}${endpoint}`,
            {
              params,
              timeout: JikanProvider.TIMEOUT_MS,
            },
          ),
        );

        return response.data;
      },
    );
  }

  private async getDetail<T>(
    endpoint: string,
  ): Promise<JikanDetailResponse<T>> {
    return this.execute(
      endpoint,
      async () => {
        const response = await lastValueFrom(
          this.httpService.get<JikanDetailResponse<T>>(
            `${this.baseUrl}${endpoint}`,
            {
              timeout: JikanProvider.TIMEOUT_MS,
            },
          ),
        );

        return response.data;
      },
    );
  }

  private enqueue<T>(request: () => Promise<T>): Promise<T> {
    const task = this.queue.then(async () => {
      await this.waitForSlot();
      return request();
    });

    this.queue = task.then(
      () => undefined,
      () => undefined,
    );

    return task;
  }

  private async waitForSlot(): Promise<void> {
    while (true) {
      const now = Date.now();
      const windowStart = now - JikanProvider.WINDOW_MS;

      while (
        this.requestTimestamps.length > 0 &&
        this.requestTimestamps[0] <= windowStart
      ) {
        this.requestTimestamps.shift();
      }

      const lastRequestAt =
        this.requestTimestamps[this.requestTimestamps.length - 1] ?? 0;

      const shortWait = Math.max(
        0,
        lastRequestAt + JikanProvider.MIN_INTERVAL_MS - now,
      );

      const minuteWait =
        this.requestTimestamps.length >=
        JikanProvider.MAX_REQUESTS_PER_WINDOW
          ? Math.max(
              0,
              this.requestTimestamps[0] + JikanProvider.WINDOW_MS - now,
            )
          : 0;

      const waitMs = Math.max(shortWait, minuteWait);

      if (waitMs <= 0) {
        this.requestTimestamps.push(Date.now());
        return;
      }

      await this.sleep(waitMs);
    }
  }

  private async execute<T>(
    operation: string,
    request: () => Promise<T>,
  ): Promise<T> {
    if (Date.now() < this.circuitOpenUntil) {
      throw new AnimeProviderError(
        this.name,
        operation,
        null,
        'El circuito de Jikan está temporalmente abierto.',
        this.circuitOpenUntil - Date.now(),
      );
    }

    let lastError: unknown;

    for (
      let attempt = 1;
      attempt <= JikanProvider.MAX_ATTEMPTS;
      attempt += 1
    ) {
      try {
        const result = await this.enqueue(request);
        this.circuitOpenUntil = 0;
        return result;
      } catch (error) {
        lastError = error;
        const status = this.getStatus(error);
        const retryable =
          status === null ||
          status === HttpStatus.TOO_MANY_REQUESTS ||
          status >= HttpStatus.INTERNAL_SERVER_ERROR;

        if (!retryable || attempt === JikanProvider.MAX_ATTEMPTS) {
          if (retryable) {
            this.circuitOpenUntil =
              Date.now() + JikanProvider.CIRCUIT_BREAK_MS;
          }
          break;
        }

        const waitMs = this.getRetryDelayMs(error, attempt);

        this.logger.warn(
          `Jikan falló en ${operation}. status=${status ?? 'network'}, ` +
            `intento=${attempt}/${JikanProvider.MAX_ATTEMPTS}. ` +
            `Reintento en ${waitMs}ms.`,
        );

        await this.sleep(waitMs);
      }
    }

    throw this.toProviderError(lastError, operation);
  }

  private toProviderError(
    error: unknown,
    operation: string,
  ): AnimeProviderError {
    const status = this.getStatus(error);
    const axiosError = error as {
      message?: string;
      response?: {
        data?: {
          message?: string;
          error?: string;
        };
      };
    };

    const message =
      axiosError.response?.data?.message ??
      axiosError.response?.data?.error ??
      axiosError.message ??
      `Jikan falló en ${operation}.`;

    return new AnimeProviderError(this.name, operation, status, message);
  }

  private getStatus(error: unknown): number | null {
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
      const value = String(retryAfter).trim();
      const seconds = Number(value);

      if (Number.isFinite(seconds) && seconds >= 0) {
        return Math.max(1_000, Math.ceil(seconds * 1_000));
      }

      const date = Date.parse(value);

      if (!Number.isNaN(date)) {
        return Math.max(1_000, date - Date.now());
      }
    }

    return attempt * 1_000;
  }

  private sleep(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
}
