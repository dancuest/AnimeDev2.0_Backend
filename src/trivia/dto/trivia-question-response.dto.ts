import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  TriviaCategory,
  TriviaDifficulty,
  TriviaQuestionSource,
  TriviaQuestionStatus,
} from '@prisma/client';

export class TriviaQuestionResponseDto {
  @ApiProperty({ example: '7dd1b315-4a44-4b91-9120-7eb1d9cc2a41' })
  id!: string;

  @ApiProperty({ example: 21 })
  animeId!: number;

  @ApiPropertyOptional({ example: '21', nullable: true })
  externalAnimeId!: string | null;

  @ApiProperty({
    example: '¿Quién es el protagonista principal de la historia?',
  })
  question!: string;

  @ApiProperty({
    example: [
      'Monkey D. Luffy',
      'Roronoa Zoro',
      'Sanji',
      'Trafalgar Law',
    ],
  })
  options!: string[];

  @ApiProperty({ example: 0 })
  correctAnswerIndex!: number;

  @ApiPropertyOptional({
    example: 'Monkey D. Luffy es el protagonista central de One Piece.',
    nullable: true,
  })
  explanation!: string | null;

  @ApiProperty({ enum: TriviaDifficulty, example: TriviaDifficulty.EASY })
  difficulty!: TriviaDifficulty;

  @ApiProperty({ enum: TriviaCategory, example: TriviaCategory.CHARACTER })
  category!: TriviaCategory;

  @ApiProperty({
    enum: TriviaQuestionStatus,
    example: TriviaQuestionStatus.APPROVED,
  })
  status!: TriviaQuestionStatus;

  @ApiProperty({
    enum: TriviaQuestionSource,
    example: TriviaQuestionSource.USER_SUBMITTED,
  })
  source!: TriviaQuestionSource;

  @ApiPropertyOptional({ example: 'user-id', nullable: true })
  createdByUserId!: string | null;

  @ApiPropertyOptional({ example: 'admin-id', nullable: true })
  reviewedByUserId!: string | null;

  @ApiProperty({ example: '2026-05-15T15:30:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-05-15T15:30:00.000Z' })
  updatedAt!: Date;

  @ApiPropertyOptional({ example: '2026-05-15T15:40:00.000Z', nullable: true })
  reviewedAt!: Date | null;
}

export class TriviaQuestionListResponseDto {
  @ApiProperty({ type: [TriviaQuestionResponseDto] })
  data!: TriviaQuestionResponseDto[];

  @ApiProperty({
    example: {
      count: 5,
    },
  })
  meta!: {
    count: number;
  };
}

export class TriviaQuestionMutationResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({
    example: 'Pregunta enviada para revisión.',
  })
  message!: string;

  @ApiProperty({ type: TriviaQuestionResponseDto })
  data!: TriviaQuestionResponseDto;
}