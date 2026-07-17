import { JikanAnime } from '../types/jikan.types';

export type AnimeProviderName = 'anilist' | 'jikan' | 'kitsu';

export interface AnimeProviderListResult {
  data: JikanAnime[];
  total: number;
  count: number;
  hasNextPage: boolean;
}

export class AnimeProviderError extends Error {
  constructor(
    public readonly provider: AnimeProviderName,
    public readonly operation: string,
    public readonly upstreamStatus: number | null,
    message: string,
    public readonly retryAfterMs: number | null = null,
  ) {
    super(message);
    this.name = 'AnimeProviderError';
  }
}
