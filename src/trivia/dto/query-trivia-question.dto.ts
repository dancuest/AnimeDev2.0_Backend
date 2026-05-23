import { ApiPropertyOptional } from '@nestjs/swagger';
import { TriviaDifficulty } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class QueryTriviaQuestionDto {
  @ApiPropertyOptional({
    enum: TriviaDifficulty,
    example: TriviaDifficulty.EASY,
    description: 'Filtra preguntas por dificultad.',
  })
  @IsOptional()
  @IsEnum(TriviaDifficulty)
  difficulty?: TriviaDifficulty;

  @ApiPropertyOptional({
    example: 10,
    minimum: 1,
    maximum: 50,
    description: 'Cantidad máxima de preguntas a retornar.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}