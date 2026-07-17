import { AnimeDto } from './anime.dto';
// Este archivo pertenece al módulo de anime y se encarga de manejar la información de los animes, ya sea para listarlos, filtrarlos o enriquecerlos.


export interface TrailerDto {
  number: number;
  title: string;
  durationMinutes: number;
  description: string;
  youtubeUrl: string;
}

export type AnimeRelationType = 'PREQUEL' | 'SEQUEL';

export interface RelatedAnimeDto {
  id: number;
  title: string;
  relationType: AnimeRelationType;
  relationLabel: string;
  url: string;
  sourceType: string;
}

export interface AnimeDetailDto {
  anime: AnimeDto;
  culturalNotes: string[];
  trailers: TrailerDto[];
  relatedAnime: RelatedAnimeDto[];
}