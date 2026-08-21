// Este archivo pertenece al módulo de anime y se encarga de manejar la información de los animes, ya sea para listarlos, filtrarlos o enriquecerlos.

export interface JikanPagination {
  last_visible_page?: number;
  has_next_page?: boolean;
  items?: {
    count?: number;
    total?: number;
    per_page?: number;
  };
}

export interface JikanNamedResource {
  mal_id: number;
  name: string;
  type?: string;
  url?: string;
}

export interface JikanRelationEntry {
  mal_id: number;
  type: string;
  name: string;
  url: string;
}

export interface JikanRelation {
  relation: string;
  entry: JikanRelationEntry[];
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
    webp?: {
      image_url?: string;
      large_image_url?: string;
    };
  };

  status?: string | null;
  airing?: boolean | null;
  episodes?: number | null;
  duration?: string | null;
  score?: number | null;
  rating?: string | null;
  year?: number | null;
  season?: string | null;
  source?: string | null;
  background?: string | null;

  aired?: {
    from?: string | null;
    to?: string | null;
    string?: string | null;
  };

  broadcast?: {
    day?: string | null;
    time?: string | null;
    timezone?: string | null;
    string?: string | null;
  };

  studios?: JikanNamedResource[];
  producers?: JikanNamedResource[];
  licensors?: JikanNamedResource[];
  genres?: JikanNamedResource[];
  themes?: JikanNamedResource[];
  demographics?: JikanNamedResource[];

  trailer?: {
    url?: string | null;
    embed_url?: string | null;
    youtube_id?: string | null;
  };

  relations?: JikanRelation[];
}

export interface JikanListResponse<T> {
  data: T[];
  pagination?: JikanPagination;
}

export interface JikanDetailResponse<T> {
  data: T;
}