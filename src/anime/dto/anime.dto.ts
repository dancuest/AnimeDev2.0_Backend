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

  /**
   * Campo heredado. Se conserva para compatibilidad con el frontend anterior.
   * Ya no debe usarse como recurso principal.
   */
  mangaPlusUrl: string;

  /**
   * Enlace real al manga relacionado cuando Jikan lo proporciona.
   */
  mangaUrl: string | null;

  /**
   * Nombre del manga relacionado cuando existe.
   */
  mangaTitle: string | null;

  /**
   * Enlace al trailer oficial cuando Jikan lo proporciona.
   */
  trailerUrl: string | null;

  totalEpisodes: number | null;
  durationType: DurationType;
  emissionStatus: EmissionStatus;
  releaseYear: number | null;
  genres: GenreDto[];
}