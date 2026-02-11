export interface JikanPagination {
  last_visible_page?: number;
  has_next_page?: boolean;
  items?: {
    count?: number;
    total?: number;
    per_page?: number;
  };
}

export interface JikanAnime {
  mal_id: number;
  title: string;
  title_english?: string | null;
  title_japanese?: string | null;
  synopsis?: string | null;
  images?: {
    jpg?: {
      image_url?: string;
      large_image_url?: string;
    };
  };
  status?: string | null;
  episodes?: number | null;
  duration?: string | null;
  score?: number | null;
  rating?: string | null;
  year?: number | null;
  season?: string | null;
  studios?: Array<{ mal_id: number; name: string }>;
  genres?: Array<{ mal_id: number; name: string }>;
  trailer?: {
    url?: string | null;
    embed_url?: string | null;
    youtube_id?: string | null;
  };
}

export interface JikanListResponse<T> {
  data: T[];
  pagination?: JikanPagination;
}

export interface JikanDetailResponse<T> {
  data: T;
}
