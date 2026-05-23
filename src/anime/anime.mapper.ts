import {
  AnimeDto,
  DurationType,
  EmissionStatus,
  GenreDto,
} from './dto/anime.dto';
import { JikanAnime, JikanRelationEntry } from './types/jikan.types';

export class AnimeMapper {
  toGenreDto(genre: { mal_id: number; name: string }): GenreDto {
    return {
      id: String(genre.mal_id),
      name: genre.name,
    };
  }

  toAnimeDto(anime: JikanAnime): AnimeDto {
    const durationMinutes = this.parseDurationMinutes(anime.duration ?? '');
    const durationType = this.toDurationType(durationMinutes);
    const emissionStatus = this.toEmissionStatus(
      anime.status ?? '',
      anime.airing ?? null,
    );

    const coverImageUrl =
      anime.images?.jpg?.large_image_url ??
      anime.images?.webp?.large_image_url ??
      anime.images?.jpg?.image_url ??
      anime.images?.webp?.image_url ??
      '';

    const title = anime.title ?? '';
    const relatedManga = this.findRelatedManga(anime);
    const mangaUrl = relatedManga?.url ?? null;

    return {
      id: anime.mal_id,
      externalApiId: String(anime.mal_id),
      title,
      originalTitle: anime.title_japanese ?? anime.title_english ?? null,
      synopsis: this.cleanSynopsis(anime.synopsis ?? ''),
      coverImageUrl,

      // Compatibilidad: antes se llamaba Manga Plus, ahora puede ser MAL manga.
      mangaPlusUrl: mangaUrl ?? '',
      mangaUrl,
      mangaTitle: relatedManga?.name ?? null,
      trailerUrl: this.buildTrailerUrl(anime.trailer),

      totalEpisodes: anime.episodes ?? null,
      durationType,
      emissionStatus,
      releaseYear: anime.year ?? null,
      genres: (anime.genres ?? []).map((genre) => this.toGenreDto(genre)),
    };
  }

  private toDurationType(minutes: number | null): DurationType {
    if (!minutes) {
      return DurationType.MEDIUM;
    }

    if (minutes <= 15) {
      return DurationType.SHORT;
    }

    if (minutes <= 35) {
      return DurationType.MEDIUM;
    }

    return DurationType.LONG;
  }

  private toEmissionStatus(
    status: string,
    airing: boolean | null,
  ): EmissionStatus {
    if (airing) {
      return EmissionStatus.ON_AIR;
    }

    const normalized = status.toLowerCase();

    if (normalized.includes('currently airing')) {
      return EmissionStatus.ON_AIR;
    }

    if (normalized.includes('finished airing')) {
      return EmissionStatus.FINISHED;
    }

    return EmissionStatus.ON_BREAK;
  }

  private parseDurationMinutes(duration: string): number | null {
    const match = duration.match(/(\d+)\s*min/);

    if (!match) {
      return null;
    }

    return Number(match[1]);
  }

  private cleanSynopsis(synopsis: string): string {
    return synopsis
      .replace(/\[Written by.*?\]/gi, '')
      .replace(/\(Source:.*?\)/gi, '')
      .trim();
  }

  private buildTrailerUrl(
    trailer?: JikanAnime['trailer'],
  ): string | null {
    if (!trailer) {
      return null;
    }

    if (trailer.url) {
      return trailer.url;
    }

    if (trailer.youtube_id) {
      return `https://www.youtube.com/watch?v=${trailer.youtube_id}`;
    }

    if (trailer.embed_url) {
      const match = trailer.embed_url.match(/\/embed\/([^?&]+)/);
      const youtubeId = match?.[1];

      if (youtubeId) {
        return `https://www.youtube.com/watch?v=${youtubeId}`;
      }

      return trailer.embed_url;
    }

    return null;
  }

  private findRelatedManga(anime: JikanAnime): JikanRelationEntry | null {
    const relations = anime.relations ?? [];

    const adaptation = relations.find((relation) =>
      relation.relation?.toLowerCase().includes('adaptation'),
    );

    const adaptationManga = adaptation?.entry?.find(
      (entry) => entry.type?.toLowerCase() === 'manga' && Boolean(entry.url),
    );

    if (adaptationManga) {
      return adaptationManga;
    }

    for (const relation of relations) {
      const manga = relation.entry?.find(
        (entry) => entry.type?.toLowerCase() === 'manga' && Boolean(entry.url),
      );

      if (manga) {
        return manga;
      }
    }

    return null;
  }
}