import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InteractionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInteractionDto } from './dto/create-interaction.dto';

@Injectable()
export class InteractionsService {
  private readonly logger = new Logger(InteractionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateInteractionDto) {
    if (dto.animeId <= 0) {
      throw new BadRequestException('animeId must be greater than 0');
    }

    const normalizedType = dto.type ?? dto.interactionType;

    if (!normalizedType) {
      throw new BadRequestException('type is required');
    }

    if (dto.interactionType && !dto.type) {
      this.logger.warn(
        `Legacy field interactionType used for user=${userId}; please migrate client payload to type`,
      );
    }

    if (normalizedType === InteractionType.TRIVIA_SCORE) {
      const score = dto.payload?.score;
      if (typeof score !== 'number' || Number.isNaN(score) || score < 0 || score > 10) {
        throw new BadRequestException(
          'TRIVIA_SCORE payload must include numeric score between 0 and 10',
        );
      }
    }

    const created = await this.prisma.userInteraction.create({
      data: {
        userId,
        animeId: dto.animeId,
        type: normalizedType,
        payload: dto.payload as any,
      },
      select: {
        id: true,
        userId: true,
        animeId: true,
        type: true,
        payload: true,
        createdAt: true,
      },
    });

    this.logger.log(
      `Interaction stored user=${userId} anime=${dto.animeId} type=${normalizedType} interactionId=${created.id}`,
    );

    return {
      success: true,
      message: 'Interaction recorded',
      interaction: created,
    };
  }

  async listMine(userId: string, limit = 50) {
    return this.prisma.userInteraction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
