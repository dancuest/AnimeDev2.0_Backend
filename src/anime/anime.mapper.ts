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
    const emissionStatus = this.toEmissionStatus(anime.status ?? '');
    const coverImageUrl =
      anime.images?.jpg?.large_image_url ??
      anime.images?.jpg?.image_url ??
      '';

    return {
      id: anime.mal_id,
      externalApiId: String(anime.mal_id),
      title: anime.title ?? '',
      originalTitle: anime.title_japanese ?? anime.title_english ?? null,
      synopsis: anime.synopsis ?? '',
      coverImageUrl,
      mangaPlusUrl: this.buildMangaPlusUrl(anime.title ?? ''),
      totalEpisodes: anime.episodes ?? null,
      durationType,
      emissionStatus,
      releaseYear: anime.year ?? null,
      genres: (anime.genres ?? []).map((genre) => this.toGenreDto(genre)),
      score: anime.score ?? null,
      rating: anime.rating ?? null,
      season: anime.season ?? null,
      status: anime.status ?? null,
      studios: (anime.studios ?? []).map((studio) => studio.name),
      trailerUrl: anime.trailer?.url ?? anime.trailer?.embed_url ?? null,
    };
  }

  private toDurationType(minutes: number | null): DurationType {
    if (!minutes) {
      return DurationType.MEDIUM;
    }

    if (minutes <= 15) {
      return DurationType.SHORT;
    }

    if (minutes <= 30) {
      return DurationType.MEDIUM;
    }

    return DurationType.LONG;
  }

  private toEmissionStatus(status: string): EmissionStatus {
    const normalized = status.toLowerCase();
    if (normalized.includes('airing')) {
      return EmissionStatus.ON_AIR;
    }
    if (normalized.includes('finished')) {
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
