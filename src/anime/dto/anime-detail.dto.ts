import { AnimeDto } from './anime.dto';

export interface TrailerDto {
  number: number;
  title: string;
  durationMinutes: number;
  description: string;
  youtubeUrl: string;
}

export interface AnimeDetailDto {
  anime: AnimeDto;
  culturalNotes: string[];
  trailers: TrailerDto[];
}
