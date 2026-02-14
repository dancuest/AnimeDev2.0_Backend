import {
  AnimeDto,
  DurationType,
  EmissionStatus,
  GenreDto,
} from './dto/anime.dto';
import { JikanAnime } from './types/jikan.types';

const DEFAULT_MANGA_PLUS_BASE =
  'https://mangaplus.shueisha.co.jp/titles?search=';

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
    const emissionStatus = this.toEmissionStatus(anime.status ?? '', anime.airing ?? null);
    const coverImageUrl =
      anime.images?.jpg?.image_url ??
      anime.images?.webp?.image_url ??
      '';
    const title = anime.title ?? '';

    return {
      id: anime.mal_id,
      externalApiId: String(anime.mal_id),
      title,
      originalTitle: anime.title_japanese ?? anime.title_english ?? null,
      synopsis: anime.synopsis ?? '',
      coverImageUrl,
      mangaPlusUrl: this.buildMangaPlusUrl(title),
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

  private toEmissionStatus(status: string, airing: boolean | null): EmissionStatus {
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

  private buildMangaPlusUrl(title: string): string {
    const encoded = encodeURIComponent(title.trim());
    return `${DEFAULT_MANGA_PLUS_BASE}${encoded}`;
  }
}
