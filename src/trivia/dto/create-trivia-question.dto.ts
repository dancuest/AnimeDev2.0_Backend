import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TriviaCategory, TriviaDifficulty } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const trimString = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
};

const trimStringArray = ({ value }: { value: unknown }) => {
  if (!Array.isArray(value)) {
    return value;
  }

  return value.map((item) => {
    if (typeof item !== 'string') {
      return item;
    }

    return item.trim();
  });
};

export class CreateTriviaQuestionDto {
  @ApiProperty({
    example: '¿Quién es el protagonista principal de la historia?',
    minLength: 10,
    maxLength: 250,
  })
  @Transform(trimString)
  @IsString()
  @MinLength(10)
  @MaxLength(250)
  question!: string;

  @ApiProperty({
    example: [
      'Monkey D. Luffy',
      'Roronoa Zoro',
      'Sanji',
      'Trafalgar Law',
    ],
    minItems: 4,
    maxItems: 4,
    description: 'Debe contener exactamente 4 opciones.',
  })
  @Transform(trimStringArray)
  @IsArray()
  @ArrayMinSize(4)
  @ArrayMaxSize(4)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(160, { each: true })
  options!: string[];

  @ApiProperty({
    example: 0,
    minimum: 0,
    maximum: 3,
    description: 'Índice de la respuesta correcta dentro del arreglo options.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3)
  correctAnswerIndex!: number;

  @ApiProperty({
    enum: TriviaDifficulty,
    example: TriviaDifficulty.EASY,
  })
  @IsEnum(TriviaDifficulty)
  difficulty!: TriviaDifficulty;

  @ApiPropertyOptional({
    enum: TriviaCategory,
    example: TriviaCategory.CHARACTER,
    default: TriviaCategory.GENERAL,
  })
  @IsOptional()
  @IsEnum(TriviaCategory)
  category?: TriviaCategory;

  @ApiPropertyOptional({
    example: 'Monkey D. Luffy es el protagonista central de One Piece.',
    maxLength: 500,
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(500)
  explanation?: string;

  @ApiPropertyOptional({
    example: '21',
    description: 'Identificador externo del anime, si se quiere almacenar además del animeId numérico.',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(40)
  externalAnimeId?: string;
}