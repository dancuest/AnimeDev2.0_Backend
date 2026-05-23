import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DurationType, EmissionStatus } from './anime.dto';

export class AnimeGenreResponseDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: 'Action' })
  name!: string;
}

export class AnimeResponseDto {
  @ApiProperty({ example: 5114 })
  id!: number;

  @ApiProperty({ example: '5114' })
  externalApiId!: string;

  @ApiProperty({ example: 'Fullmetal Alchemist: Brotherhood' })
  title!: string;

  @ApiPropertyOptional({
    example: 'Hagane no Renkinjutsushi: Fullmetal Alchemist',
    nullable: true,
  })
  originalTitle!: string | null;

  @ApiProperty({
    example:
      'Dos hermanos buscan la Piedra Filosofal después de un experimento de alquimia fallido.',
    description:
      'Sinopsis del anime. Cuando la traducción automática está habilitada, se intenta entregar en español; si falla, se conserva la sinopsis original.',
  })
  synopsis!: string;

  @ApiProperty({
    example: 'https://cdn.myanimelist.net/images/anime/1223/96541.jpg',
  })
  coverImageUrl!: string;

  @ApiProperty({
    example: '',
    deprecated: true,
    description:
      'Campo heredado conservado por compatibilidad. Ya no se usa como recurso principal de manga.',
  })
  mangaPlusUrl!: string;

  @ApiPropertyOptional({
    example: 'https://myanimelist.net/manga/25/Fullmetal_Alchemist',
    nullable: true,
    description:
      'Enlace al manga relacionado cuando la fuente externa lo proporciona.',
  })
  mangaUrl!: string | null;

  @ApiPropertyOptional({
    example: 'Fullmetal Alchemist',
    nullable: true,
    description: 'Nombre del manga relacionado.',
  })
  mangaTitle!: string | null;

  @ApiPropertyOptional({
    example: 'https://www.youtube.com/watch?v=--IcmZkvL0Q',
    nullable: true,
    description:
      'URL del trailer oficial cuando está disponible en la fuente externa.',
  })
  trailerUrl!: string | null;

  @ApiPropertyOptional({
    example: 64,
    nullable: true,
  })
  totalEpisodes!: number | null;

  @ApiProperty({
    enum: DurationType,
    example: DurationType.MEDIUM,
  })
  durationType!: DurationType;

  @ApiProperty({
    enum: EmissionStatus,
    example: EmissionStatus.FINISHED,
  })
  emissionStatus!: EmissionStatus;

  @ApiPropertyOptional({
    example: 2009,
    nullable: true,
  })
  releaseYear!: number | null;

  @ApiProperty({
    type: [AnimeGenreResponseDto],
  })
  genres!: AnimeGenreResponseDto[];
}

export class TrailerResponseDto {
  @ApiProperty({ example: 1 })
  number!: number;

  @ApiProperty({ example: 'Trailer oficial' })
  title!: string;

  @ApiProperty({ example: 2 })
  durationMinutes!: number;

  @ApiProperty({
    example: 'Avance oficial disponible en YouTube.',
  })
  description!: string;

  @ApiProperty({
    example: 'https://www.youtube.com/watch?v=XXXXX',
  })
  youtubeUrl!: string;
}

export class AnimeDetailDataResponseDto {
  @ApiProperty({ type: AnimeResponseDto })
  anime!: AnimeResponseDto;

  @ApiProperty({
    type: [String],
    example: ['Obra influyente dentro del shonen moderno.'],
    description:
      'Notas culturales o contextuales asociadas al anime consultado.',
  })
  culturalNotes!: string[];

  @ApiProperty({
    type: [TrailerResponseDto],
    deprecated: true,
    description:
      'Campo heredado. Se conserva vacío para compatibilidad con versiones anteriores del frontend. El trailer oficial se consulta mediante anime.trailerUrl.',
  })
  trailers!: TrailerResponseDto[];
}

export class LimitMetaResponseDto {
  @ApiProperty({ example: 10 })
  limit!: number;
}

export class SearchMetaResponseDto {
  @ApiProperty({ example: 10 })
  limit!: number;

  @ApiProperty({ example: 245 })
  total!: number;

  @ApiProperty({ example: 10 })
  count!: number;

  @ApiProperty({ example: true })
  hasNextPage!: boolean;
}

export class AnimeListResponseDto {
  @ApiProperty({ type: [AnimeResponseDto] })
  data!: AnimeResponseDto[];

  @ApiProperty({ type: LimitMetaResponseDto })
  meta!: LimitMetaResponseDto;
}

export class AnimeSearchResponseDto {
  @ApiProperty({ type: [AnimeResponseDto] })
  data!: AnimeResponseDto[];

  @ApiProperty({ type: SearchMetaResponseDto })
  meta!: SearchMetaResponseDto;
}

export class AnimeSingleResponseDto {
  @ApiProperty({ type: AnimeResponseDto })
  data!: AnimeResponseDto;
}

export class AnimeDetailResponseDto {
  @ApiProperty({ type: AnimeDetailDataResponseDto })
  data!: AnimeDetailDataResponseDto;
}

export class AnimeGenreCatalogResponseDto {
  @ApiProperty({ type: [AnimeGenreResponseDto] })
  data!: AnimeGenreResponseDto[];
}