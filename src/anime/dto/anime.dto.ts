export enum DurationType {
  SHORT = 'SHORT',
  MEDIUM = 'MEDIUM',
  LONG = 'LONG',
}

export enum EmissionStatus {
  ON_AIR = 'ON_AIR',
  FINISHED = 'FINISHED',
  ON_BREAK = 'ON_BREAK',
}

export interface GenreDto {
  id: string;
  name: string;
}

export interface AnimeDto {
  id: number;
  externalApiId: string;
  title: string;
  originalTitle: string | null;
  synopsis: string;
  coverImageUrl: string;
  mangaPlusUrl: string;
  totalEpisodes: number | null;
  durationType: DurationType;
  emissionStatus: EmissionStatus;
  releaseYear: number | null;
  genres: GenreDto[];
}
