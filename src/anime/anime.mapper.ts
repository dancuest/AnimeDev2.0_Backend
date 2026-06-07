import {
  AnimeDto,
  DurationType,
  EmissionStatus,
  GenreDto,
} from './dto/anime.dto';
import { JikanAnime, JikanRelationEntry } from './types/jikan.types';

const GENRE_TRANSLATIONS_BY_ID: Record<string, string> = {
  '1': 'Acción',
  '2': 'Aventura',
  '3': 'Carreras',
  '4': 'Comedia',
  '5': 'Vanguardia',
  '6': 'Mitología',
  '7': 'Misterio',
  '8': 'Drama',
  '9': 'Ecchi',
  '10': 'Fantasía',
  '11': 'Juego de estrategia',
  '12': 'Hentai',
  '13': 'Histórico',
  '14': 'Terror',
  '15': 'Infantil',
  '17': 'Artes marciales',
  '18': 'Mecha',
  '19': 'Música',
  '20': 'Parodia',
  '21': 'Samurái',
  '22': 'Romance',
  '23': 'Escolar',
  '24': 'Ciencia ficción',
  '25': 'Shōjo',
  '26': 'Amor entre chicas',
  '27': 'Shōnen',
  '28': 'Amor entre chicos',
  '29': 'Espacial',
  '30': 'Deportes',
  '31': 'Superpoderes',
  '32': 'Vampiros',
  '35': 'Harén',
  '36': 'Recuentos de la vida',
  '37': 'Sobrenatural',
  '38': 'Militar',
  '39': 'Detective',
  '40': 'Psicológico',
  '41': 'Suspenso',
  '42': 'Seinen',
  '43': 'Josei',
  '46': 'Premiado',
  '47': 'Gastronomía',
  '48': 'Entorno laboral',
  '49': 'Erótica',
  '50': 'Elenco adulto',
  '51': 'Antropomórfico',
  '52': 'Chicas lindas haciendo cosas lindas',
  '53': 'Cuidado infantil',
  '54': 'Deportes de combate',
  '55': 'Delincuentes',
  '56': 'Educativo',
  '57': 'Humor absurdo',
  '58': 'Gore',
  '59': 'Juego de alto riesgo',
  '60': 'Ídols femeninas',
  '61': 'Ídols masculinos',
  '62': 'Isekai',
  '63': 'Iyashikei',
  '64': 'Polígono amoroso',
  '65': 'Cambio mágico de sexo',
  '66': 'Chica mágica',
  '67': 'Médico',
  '68': 'Crimen organizado',
  '69': 'Cultura otaku',
  '70': 'Artes escénicas',
  '71': 'Mascotas',
  '72': 'Reencarnación',
  '73': 'Harén inverso',
  '74': 'Subtexto romántico',
  '75': 'Espectáculo',
  '76': 'Supervivencia',
  '77': 'Deportes de equipo',
  '78': 'Viajes en el tiempo',
  '79': 'Videojuegos',
  '80': 'Artes visuales',
  '81': 'Travestismo',
};

const GENRE_TRANSLATIONS_BY_NAME: Record<string, string> = {
  action: 'Acción',
  adventure: 'Aventura',
  racing: 'Carreras',
  comedy: 'Comedia',
  'avant garde': 'Vanguardia',
  mythology: 'Mitología',
  mystery: 'Misterio',
  drama: 'Drama',
  ecchi: 'Ecchi',
  fantasy: 'Fantasía',
  'strategy game': 'Juego de estrategia',
  hentai: 'Hentai',
  historical: 'Histórico',
  horror: 'Terror',
  kids: 'Infantil',
  'martial arts': 'Artes marciales',
  mecha: 'Mecha',
  music: 'Música',
  parody: 'Parodia',
  samurai: 'Samurái',
  romance: 'Romance',
  school: 'Escolar',
  'sci fi': 'Ciencia ficción',
  shoujo: 'Shōjo',
  shojo: 'Shōjo',
  'girls love': 'Amor entre chicas',
  shounen: 'Shōnen',
  shonen: 'Shōnen',
  'boys love': 'Amor entre chicos',
  space: 'Espacial',
  sports: 'Deportes',
  'super power': 'Superpoderes',
  vampire: 'Vampiros',
  vampires: 'Vampiros',
  harem: 'Harén',
  'slice of life': 'Recuentos de la vida',
  supernatural: 'Sobrenatural',
  military: 'Militar',
  detective: 'Detective',
  psychological: 'Psicológico',
  suspense: 'Suspenso',
  seinen: 'Seinen',
  josei: 'Josei',
  'award winning': 'Premiado',
  gourmet: 'Gastronomía',
  workplace: 'Entorno laboral',
  erotica: 'Erótica',
  'adult cast': 'Elenco adulto',
  anthropomorphic: 'Antropomórfico',
  cgdct: 'Chicas lindas haciendo cosas lindas',
  childcare: 'Cuidado infantil',
  'combat sports': 'Deportes de combate',
  delinquents: 'Delincuentes',
  educational: 'Educativo',
  'gag humor': 'Humor absurdo',
  gore: 'Gore',
  'high stakes game': 'Juego de alto riesgo',
  'idols female': 'Ídols femeninas',
  'idols male': 'Ídols masculinos',
  isekai: 'Isekai',
  iyashikei: 'Iyashikei',
  'love polygon': 'Polígono amoroso',
  'magical sex shift': 'Cambio mágico de sexo',
  'mahou shoujo': 'Chica mágica',
  medical: 'Médico',
  'organized crime': 'Crimen organizado',
  'otaku culture': 'Cultura otaku',
  'performing arts': 'Artes escénicas',
  pets: 'Mascotas',
  reincarnation: 'Reencarnación',
  'reverse harem': 'Harén inverso',
  'romantic subtext': 'Subtexto romántico',
  showbiz: 'Espectáculo',
  survival: 'Supervivencia',
  'team sports': 'Deportes de equipo',
  'time travel': 'Viajes en el tiempo',
  'video game': 'Videojuegos',
  'visual arts': 'Artes visuales',
  crossdressing: 'Travestismo',
};

function normalizeGenreName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function translateGenreName(id: string, name: string): string {
  const normalizedName = normalizeGenreName(name);

  return (
    GENRE_TRANSLATIONS_BY_ID[id] ??
    GENRE_TRANSLATIONS_BY_NAME[normalizedName] ??
    name
  );
}

export class AnimeMapper {
  toGenreDto(genre: { mal_id: number; name: string }): GenreDto {
    const id = String(genre.mal_id);

    return {
      id,
      name: translateGenreName(id, genre.name),
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

  private buildTrailerUrl(trailer?: JikanAnime['trailer']): string | null {
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