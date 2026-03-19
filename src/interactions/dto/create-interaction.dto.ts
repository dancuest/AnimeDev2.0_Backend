import { InteractionType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsObject, IsOptional, Min } from 'class-validator';

export class CreateInteractionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  animeId!: number;

  @Transform(({ value, obj }) => value ?? obj?.interactionType)
  @IsEnum(InteractionType)
  type!: InteractionType;

  @IsOptional()
  @IsEnum(InteractionType)
  interactionType?: InteractionType;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
