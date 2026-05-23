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
import { AnimeDetailDto } from './dto/anime-detail.dto';
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
      `AnimeService iniciado. translateSynopses=${this.translateSynopses}, translationEmail=${
        this.translationEmail ? 'configurado' : 'no configurado'
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
    const cacheKey = `anime:top:${limit}:${
      includeAdult === true ? 'all' : 'sfw'
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

    const cacheKey = `anime:search:${normalizedQuery}:${limit}:${
      includeAdult === true ? 'all' : 'sfw'
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

  async getById(id: number, requestId?: string): Promise<{ data: AnimeDto }> {
    /**
     * Versión nueva para evitar reutilizar caché vieja en inglés.
     * Este endpoint lo usan recomendaciones/favoritos cuando se restaura por ID.
     */
    const cacheKey = `anime:${id}:es:v21`;

    const anime = await this.getCached(cacheKey, async () => {
      const response = await this.fetchDetail<JikanAnime>(
        `/anime/${id}`,
        requestId,
      );

      const mappedAnime = this.mapper.toAnimeDto(response.data);

      return this.withSpanishSynopsis(mappedAnime);
    });

    return {
      data: anime,
    };
  }

  async getDetail(
    id: number,
    requestId?: string,
  ): Promise<{ data: AnimeDetailDto }> {
    /**
     * Nueva versión para no reutilizar cache vieja en inglés.
     */
    const cacheKey = `anime:detail:${id}:full:es:v21`;

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
    const cacheKey = `anime:genre:${genreId}:${limit}:${
      includeAdult === true ? 'all' : 'sfw'
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
    try {
      const response = await lastValueFrom(
        this.httpService.get<JikanListResponse<T>>(
          `${this.baseUrl}${endpoint}`,
          {
            params,
          },
        ),
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
        this.httpService.get<JikanDetailResponse<T>>(
          `${this.baseUrl}${endpoint}`,
        ),
      );

      return response.data;
    } catch (error) {
      throw this.buildUpstreamError(error, requestId, endpoint);
    }
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

    const fresh = await fetcher();

    await this.cacheManager.set(key, fresh, ttlMs);

    return fresh;
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
      upstreamStatus && upstreamStatus >= 500
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
      const studioNames = source.studios
        .slice(0, 2)
        .map((studio) => studio.name)
        .join(', ');

      notes.push(`Producción a cargo de ${studioNames}.`);
    }

    if (anime.genres.length > 0) {
      const genreNames = anime.genres
        .slice(0, 3)
        .map((genre) => genre.name)
        .join(', ');

      notes.push(`Combina elementos de ${genreNames}.`);
    }

    notes.push('Ideal para explorar nuevas tendencias del anime.');
    notes.push('Recomendado para fans que buscan historias memorables.');

    return notes.slice(0, 4);
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
        `MyMemory devolvió una traducción no utilizable. animeId=${
          animeId ?? 'unknown'
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
        `Google Translate devolvió una traducción no utilizable. animeId=${
          animeId ?? 'unknown'
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