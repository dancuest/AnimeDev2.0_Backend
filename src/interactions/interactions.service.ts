import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';

import { InteractionType } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateInteractionDto } from './dto/create-interaction.dto';

// Este archivo gestiona las interacciones del usuario con el contenido,
// algo clave para construir el historial y alimentar las recomendaciones.

@Injectable()
export class InteractionsService {
  // Aquí voy dejando registro de las acciones del usuario sobre los animes.
  // Eso después sirve para alimentar el recomendador y el historial del perfil.
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
      const totalQuestions = dto.payload?.totalQuestions;

      if (
        typeof score !== 'number' ||
        Number.isNaN(score) ||
        score < 0 ||
        score > 100
      ) {
        throw new BadRequestException(
          'TRIVIA_SCORE payload must include numeric score between 0 and 100',
        );
      }

      if (
        totalQuestions !== undefined &&
        (
          typeof totalQuestions !== 'number' ||
          Number.isNaN(totalQuestions) ||
          totalQuestions <= 0 ||
          totalQuestions > 100
        )
      ) {
        throw new BadRequestException(
          'TRIVIA_SCORE payload totalQuestions must be numeric between 1 and 100',
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

  /**
   * Obtiene el estado actual de las interacciones relevantes
   * del usuario con un anime.
   *
   * FAVORITE / UNFAVORITE controlan únicamente isFavorite.
   * DISLIKE controla únicamente hasDisliked.
   *
   * Por lo tanto, ambas señales pueden coexistir:
   *
   * FAVORITE + DISLIKE
   *
   * produce:
   *
   * isFavorite = true
   * hasDisliked = true
   */
  async getInteractionStatus(
    userId: string,
    animeId: number,
  ) {
    if (animeId <= 0) {
      throw new BadRequestException(
        'animeId must be greater than 0',
      );
    }

    const interactions =
      await this.prisma.userInteraction.findMany({
        where: {
          userId,
          animeId,
          type: {
            in: [
              InteractionType.FAVORITE,
              InteractionType.UNFAVORITE,
              InteractionType.DISLIKE,
            ],
          },
        },
        select: {
          type: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

    /*
     * FAVORITE / UNFAVORITE
     *
     * Se evalúan independientemente de DISLIKE.
     *
     * Solo la interacción más reciente entre FAVORITE
     * y UNFAVORITE determina el estado actual de favorito.
     */
    const favoriteInteractions = interactions.filter(
      (interaction) =>
        interaction.type === InteractionType.FAVORITE ||
        interaction.type === InteractionType.UNFAVORITE,
    );

    const latestFavoriteInteraction =
      favoriteInteractions[0] ?? null;

    const isFavorite =
      latestFavoriteInteraction?.type ===
      InteractionType.FAVORITE;

    /*
     * DISLIKE
     *
     * Se evalúa independientemente de FAVORITE/UNFAVORITE.
     *
     * Si existe una interacción DISLIKE, la UI puede
     * representar que el usuario ya expresó esa señal.
     *
     * En consecuencia, FAVORITE + DISLIKE puede coexistir.
     */
    const hasDisliked = interactions.some(
      (interaction) =>
        interaction.type === InteractionType.DISLIKE,
    );

    return {
      animeId,
      isFavorite,
      hasDisliked,
    };
  }

  async getFavoriteAnimeIds(
    userId: string,
  ): Promise<number[]> {
    const interactions =
      await this.prisma.userInteraction.findMany({
        where: {
          userId,
          type: {
            in: [
              InteractionType.FAVORITE,
              InteractionType.UNFAVORITE,
            ],
          },
        },
        select: {
          animeId: true,
          type: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

    const latestByAnime =
      new Map<number, InteractionType>();

    for (const interaction of interactions) {
      if (!latestByAnime.has(interaction.animeId)) {
        latestByAnime.set(
          interaction.animeId,
          interaction.type,
        );
      }
    }

    return Array.from(latestByAnime.entries())
      .filter(
        ([, type]) =>
          type === InteractionType.FAVORITE,
      )
      .map(([animeId]) => animeId);
  }
}