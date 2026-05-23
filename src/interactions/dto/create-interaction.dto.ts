import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InteractionType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsObject, IsOptional, Min } from 'class-validator';

export class CreateInteractionDto {
  @ApiProperty({
    example: 5114,
    description: 'Anime id associated with the interaction',
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  animeId!: number;

  @ApiProperty({
    enum: InteractionType,
    example: InteractionType.FAVORITE,
    description: 'Primary interaction type to register',
  })
  @Transform(({ value, obj }) => value ?? obj?.interactionType)
  @IsEnum(InteractionType)
  type!: InteractionType;

  @ApiPropertyOptional({
    enum: InteractionType,
    example: InteractionType.FAVORITE,
    description:
      'Legacy alias accepted by the backend; used when type is not provided',
  })
  @IsOptional()
  @IsEnum(InteractionType)
  interactionType?: InteractionType;

  @ApiPropertyOptional({
    type: Object,
    example: {
      score: 8,
      totalQuestions: 10,
      source: 'trivia',
    },
    description: 'Additional metadata associated with the interaction',
  })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}