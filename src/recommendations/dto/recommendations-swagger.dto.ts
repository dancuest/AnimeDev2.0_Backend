import { ApiProperty } from '@nestjs/swagger';
import { AnimeResponseDto } from '../../anime/dto/anime-swagger.dto';
// Este archivo forma parte del motor de recomendaciones. Aquí se define cómo se interpreta el comportamiento del usuario para sugerir contenido más útil.


export class RecommendationMetaResponseDto {
  @ApiProperty({
    example: 'hybrid_cosine_preferences',
  })
  algorithm!: string;

  @ApiProperty({
    example: 'hybrid',
    description:
      'Possible values observed in service flow: hybrid, collaborative, cold_start, fallback',
  })
  strategy!: string;

  @ApiProperty({ example: 10 })
  count!: number;
}

export class RecommendationsResponseDto {
  @ApiProperty({ type: [AnimeResponseDto] })
  data!: AnimeResponseDto[];

  @ApiProperty({ type: RecommendationMetaResponseDto })
  meta!: RecommendationMetaResponseDto;
}