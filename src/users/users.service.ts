import { Injectable, Logger } from '@nestjs/common';
import { InteractionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AnimeService } from '../anime/anime.service';

type UpdateProfileDto = {
  displayName?: string;
  email?: string;
  avatarUrl?: string;
  coverImageUrl?: string;
};

type UpdateSettingsDto = {
  ageRange?: number;
  genderCode?: number;
  regionCode?: number;
  preferredGenres?: number[];
  preferredDurations?: string[];
  toggles?: any;
};

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly animeService: AnimeService,
  ) {}

  async getMe(userId: string) {
    const [user, stats] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          deviceId: true,
          email: true,
          displayName: true,
          avatarUrl: true,
          coverImageUrl: true,
          createdAt: true,
        },
      }),
      this.buildInteractionStats(userId),
    ]);

    if (!user) {
      return null;
    }

    return {
      ...user,
      completedTrivias: stats.completedTrivias,
      favoriteCount: stats.favoriteCount,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const normalizedEmail = dto.email?.trim();
    const emailUpdateValue =
      dto.email === undefined ? undefined : normalizedEmail ? normalizedEmail : null;

    const avatarUrlUpdateValue = this.normalizeOptionalStringField(dto.avatarUrl);
    const coverImageUrlUpdateValue = this.normalizeOptionalStringField(dto.coverImageUrl);

    const [user, stats] = await Promise.all([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          displayName: dto.displayName?.trim() || undefined,
          email: emailUpdateValue,
          avatarUrl: avatarUrlUpdateValue,
          coverImageUrl: coverImageUrlUpdateValue,
        },
        select: {
          id: true,
          deviceId: true,
          email: true,
          displayName: true,
          avatarUrl: true,
          coverImageUrl: true,
          createdAt: true,
        },
      }),
      this.buildInteractionStats(userId),
    ]);

    return {
      ...user,
      completedTrivias: stats.completedTrivias,
      favoriteCount: stats.favoriteCount,
    };
  }

  async getMySettings(userId: string) {
    const settings = await this.prisma.userSettings.upsert({
      where: { userId },
      update: {},
      create: { userId },
      select: {
        userId: true,
        ageRange: true,
        genderCode: true,
        regionCode: true,
        preferredGenres: true,
        preferredDurations: true,
        toggles: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const preferredGenreDetails = await this.resolvePreferredGenreDetails(
      settings.preferredGenres,
    );

    return {
      ...settings,
      preferredGenreDetails,
    };
  }

  async updateMySettings(userId: string, dto: UpdateSettingsDto) {
    const settings = await this.prisma.userSettings.upsert({
      where: { userId },
      update: {
        ageRange: dto.ageRange ?? undefined,
        genderCode: dto.genderCode ?? undefined,
        regionCode: dto.regionCode ?? undefined,
        preferredGenres: dto.preferredGenres ?? undefined,
        preferredDurations: dto.preferredDurations ?? undefined,
        toggles: dto.toggles ?? undefined,
      },
      create: {
        userId,
        ageRange: dto.ageRange ?? 0,
        genderCode: dto.genderCode ?? 0,
        regionCode: dto.regionCode ?? 0,
        preferredGenres: dto.preferredGenres ?? [],
        preferredDurations: dto.preferredDurations ?? [],
        toggles: dto.toggles ?? {},
      },
      select: {
        userId: true,
        ageRange: true,
        genderCode: true,
        regionCode: true,
        preferredGenres: true,
        preferredDurations: true,
        toggles: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const preferredGenreDetails = await this.resolvePreferredGenreDetails(
      settings.preferredGenres,
    );

    return {
      ...settings,
      preferredGenreDetails,
    };
  }

  private async resolvePreferredGenreDetails(preferredGenres: number[]) {
    if (!preferredGenres.length) {
      return [];
    }

    try {
      const genresCatalog = await this.animeService.getGenres(true);

      const genreMap = new Map(
        genresCatalog.data.map((genre) => [
          Number(genre.id),
          { id: Number(genre.id), name: genre.name },
        ]),
      );

      return preferredGenres
        .map((genreId) => genreMap.get(genreId))
        .filter((genre): genre is { id: number; name: string } => Boolean(genre));
    } catch (error) {
      this.logger.warn('Could not resolve preferred genre details from catalog');
      return [];
    }
  }

  private async buildInteractionStats(userId: string) {
    const interactions = await this.prisma.userInteraction.findMany({
      where: {
        userId,
        type: {
          in: [
            InteractionType.FAVORITE,
            InteractionType.UNFAVORITE,
            InteractionType.TRIVIA_SCORE,
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

    let completedTrivias = 0;
    const latestFavoriteStateByAnime = new Map<number, InteractionType>();

    for (const interaction of interactions) {
      if (interaction.type === InteractionType.TRIVIA_SCORE) {
        completedTrivias += 1;
      }

      if (
        interaction.type === InteractionType.FAVORITE ||
        interaction.type === InteractionType.UNFAVORITE
      ) {
        if (!latestFavoriteStateByAnime.has(interaction.animeId)) {
          latestFavoriteStateByAnime.set(interaction.animeId, interaction.type);
        }
      }
    }

    const favoriteCount = Array.from(latestFavoriteStateByAnime.values()).filter(
      (type) => type === InteractionType.FAVORITE,
    ).length;

    return {
      completedTrivias,
      favoriteCount,
    };
  }

  private normalizeOptionalStringField(value?: string) {
    if (value === undefined) {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
}