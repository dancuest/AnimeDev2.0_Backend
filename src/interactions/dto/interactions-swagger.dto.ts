import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InteractionType } from '@prisma/client';

export class InteractionRecordResponseDto {
  @ApiProperty({ example: 'cly8e2mws0001abcd1234efgh' })
  id!: string;

  @ApiProperty({ example: '6e371561-2132-4040-9809-efe4f5b39e02' })
  userId!: string;

  @ApiProperty({ example: 5114 })
  animeId!: number;

  @ApiProperty({
    enum: InteractionType,
    example: InteractionType.FAVORITE,
  })
  type!: InteractionType;

  @ApiPropertyOptional({
    type: Object,
    example: {
      score: 8,
      totalQuestions: 10,
    },
    nullable: true,
  })
  payload?: Record<string, unknown> | null;

  @ApiProperty({
    example: '2026-04-07T18:25:00.000Z',
  })
  createdAt!: string;
}

export class InteractionCreateResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'Interaction recorded' })
  message!: string;

  @ApiProperty({ type: InteractionRecordResponseDto })
  interaction!: InteractionRecordResponseDto;
}