// Este archivo pertenece al módulo de anime y se encarga de manejar la información de los animes, ya sea para listarlos, filtrarlos o enriquecerlos.

export interface AnimeGenreCatalogEntry {
  id: string;
  englishName: string;
  anilistGenre?: string;
  anilistTag?: string;
  kitsuSlug?: string;
  aliases?: string[];
}

export interface JikanGenreResource {
  mal_id: number;
  name: string;
}

export const ANIME_GENRE_CATALOG: readonly AnimeGenreCatalogEntry[] = [
  { id: '1', englishName: "Action", anilistGenre: "Action", kitsuSlug: "action" },
  { id: '2', englishName: "Adventure", anilistGenre: "Adventure", kitsuSlug: "adventure" },
  { id: '3', englishName: "Racing", anilistTag: "Racing", kitsuSlug: "racing" },
  { id: '4', englishName: "Comedy", anilistGenre: "Comedy", kitsuSlug: "comedy" },
  { id: '5', englishName: "Avant Garde", anilistTag: "Avant Garde", kitsuSlug: "avant-garde" },
  { id: '6', englishName: "Mythology", anilistTag: "Mythology", kitsuSlug: "mythology" },
  { id: '7', englishName: "Mystery", anilistGenre: "Mystery", kitsuSlug: "mystery" },
  { id: '8', englishName: "Drama", anilistGenre: "Drama", kitsuSlug: "drama" },
  { id: '9', englishName: "Ecchi", anilistGenre: "Ecchi", kitsuSlug: "ecchi" },
  { id: '10', englishName: "Fantasy", anilistGenre: "Fantasy", kitsuSlug: "fantasy" },
  { id: '11', englishName: "Strategy Game", anilistTag: "Strategy Game", kitsuSlug: "strategy-game" },
  { id: '12', englishName: "Hentai", anilistTag: "Hentai", kitsuSlug: "hentai" },
  { id: '13', englishName: "Historical", anilistTag: "Historical", kitsuSlug: "historical" },
  { id: '14', englishName: "Horror", anilistGenre: "Horror", kitsuSlug: "horror" },
  { id: '15', englishName: "Kids", anilistTag: "Kids", kitsuSlug: "kids", aliases: ["Children"] },
  { id: '17', englishName: "Martial Arts", anilistTag: "Martial Arts", kitsuSlug: "martial-arts" },
  { id: '18', englishName: "Mecha", anilistGenre: "Mecha", kitsuSlug: "mecha" },
  { id: '19', englishName: "Music", anilistGenre: "Music", kitsuSlug: "music" },
  { id: '20', englishName: "Parody", anilistTag: "Parody", kitsuSlug: "parody" },
  { id: '21', englishName: "Samurai", anilistTag: "Samurai", kitsuSlug: "samurai" },
  { id: '22', englishName: "Romance", anilistGenre: "Romance", kitsuSlug: "romance" },
  { id: '23', englishName: "School", anilistTag: "School", kitsuSlug: "school" },
  { id: '24', englishName: "Sci-Fi", anilistGenre: "Sci-Fi", kitsuSlug: "science-fiction", aliases: ["Sci Fi", "Science Fiction"] },
  { id: '25', englishName: "Shoujo", anilistTag: "Shoujo", kitsuSlug: "shoujo", aliases: ["Shojo"] },
  { id: '26', englishName: "Girls Love", anilistTag: "Yuri", kitsuSlug: "girls-love", aliases: ["Girls' Love", "Yuri"] },
  { id: '27', englishName: "Shounen", anilistTag: "Shounen", kitsuSlug: "shounen", aliases: ["Shonen"] },
  { id: '28', englishName: "Boys Love", anilistTag: "Boys' Love", kitsuSlug: "boys-love", aliases: ["Boys' Love", "Yaoi"] },
  { id: '29', englishName: "Space", anilistTag: "Space", kitsuSlug: "space" },
  { id: '30', englishName: "Sports", anilistGenre: "Sports", kitsuSlug: "sports" },
  { id: '31', englishName: "Super Power", anilistTag: "Super Power", kitsuSlug: "super-power", aliases: ["Superpower"] },
  { id: '32', englishName: "Vampire", anilistTag: "Vampire", kitsuSlug: "vampire", aliases: ["Vampires"] },
  { id: '35', englishName: "Harem", anilistTag: "Harem", kitsuSlug: "harem" },
  { id: '36', englishName: "Slice of Life", anilistGenre: "Slice of Life", kitsuSlug: "slice-of-life" },
  { id: '37', englishName: "Supernatural", anilistGenre: "Supernatural", kitsuSlug: "supernatural" },
  { id: '38', englishName: "Military", anilistTag: "Military", kitsuSlug: "military" },
  { id: '39', englishName: "Detective", anilistTag: "Detective", kitsuSlug: "detective" },
  { id: '40', englishName: "Psychological", anilistGenre: "Psychological", kitsuSlug: "psychological" },
  { id: '41', englishName: "Suspense", anilistGenre: "Thriller", kitsuSlug: "thriller", aliases: ["Thriller"] },
  { id: '42', englishName: "Seinen", anilistTag: "Seinen", kitsuSlug: "seinen" },
  { id: '43', englishName: "Josei", anilistTag: "Josei", kitsuSlug: "josei" },
  { id: '46', englishName: "Award Winning", anilistTag: "Award Winning", kitsuSlug: "award-winning" },
  { id: '47', englishName: "Gourmet", anilistTag: "Food", kitsuSlug: "food", aliases: ["Cooking"] },
  { id: '48', englishName: "Workplace", anilistTag: "Work", kitsuSlug: "workplace" },
  { id: '49', englishName: "Erotica", anilistTag: "Erotica", kitsuSlug: "erotica" },
  { id: '50', englishName: "Adult Cast", anilistTag: "Primarily Adult Cast", kitsuSlug: "adult-cast" },
  { id: '51', englishName: "Anthropomorphic", anilistTag: "Anthropomorphism", kitsuSlug: "anthropomorphic" },
  { id: '52', englishName: "CGDCT", anilistTag: "Cute Girls Doing Cute Things", kitsuSlug: "cgdct", aliases: ["Cute Girls Doing Cute Things"] },
  { id: '53', englishName: "Childcare", anilistTag: "Childcare", kitsuSlug: "childcare" },
  { id: '54', englishName: "Combat Sports", anilistTag: "Combat Sports", kitsuSlug: "combat-sports" },
  { id: '55', englishName: "Delinquents", anilistTag: "Delinquents", kitsuSlug: "delinquents" },
  { id: '56', englishName: "Educational", anilistTag: "Educational", kitsuSlug: "educational" },
  { id: '57', englishName: "Gag Humor", anilistTag: "Gag Humor", kitsuSlug: "gag-humor" },
  { id: '58', englishName: "Gore", anilistTag: "Gore", kitsuSlug: "gore" },
  { id: '59', englishName: "High Stakes Game", anilistTag: "High Stakes Games", kitsuSlug: "high-stakes-game" },
  { id: '60', englishName: "Idols (Female)", anilistTag: "Female Idol", kitsuSlug: "female-idols", aliases: ["Idol", "Idols Female"] },
  { id: '61', englishName: "Idols (Male)", anilistTag: "Male Idol", kitsuSlug: "male-idols", aliases: ["Idols Male"] },
  { id: '62', englishName: "Isekai", anilistTag: "Isekai", kitsuSlug: "isekai" },
  { id: '63', englishName: "Iyashikei", anilistTag: "Iyashikei", kitsuSlug: "iyashikei" },
  { id: '64', englishName: "Love Polygon", anilistTag: "Love Triangle", kitsuSlug: "love-polygon" },
  { id: '65', englishName: "Magical Sex Shift", anilistTag: "Gender Bending", kitsuSlug: "gender-bender" },
  { id: '66', englishName: "Mahou Shoujo", anilistGenre: "Mahou Shoujo", kitsuSlug: "magical-girl", aliases: ["Magical Girl"] },
  { id: '67', englishName: "Medical", anilistTag: "Medicine", kitsuSlug: "medical" },
  { id: '68', englishName: "Organized Crime", anilistTag: "Organised Crime", kitsuSlug: "organized-crime", aliases: ["Organized Crime"] },
  { id: '69', englishName: "Otaku Culture", anilistTag: "Otaku Culture", kitsuSlug: "otaku-culture" },
  { id: '70', englishName: "Performing Arts", anilistTag: "Performing Arts", kitsuSlug: "performing-arts" },
  { id: '71', englishName: "Pets", anilistTag: "Animals", kitsuSlug: "pets" },
  { id: '72', englishName: "Reincarnation", anilistTag: "Reincarnation", kitsuSlug: "reincarnation" },
  { id: '73', englishName: "Reverse Harem", anilistTag: "Reverse Harem", kitsuSlug: "reverse-harem" },
  { id: '74', englishName: "Romantic Subtext", anilistTag: "Romantic Subtext", kitsuSlug: "romantic-subtext" },
  { id: '75', englishName: "Showbiz", anilistTag: "Showbiz", kitsuSlug: "showbiz" },
  { id: '76', englishName: "Survival", anilistTag: "Survival", kitsuSlug: "survival" },
  { id: '77', englishName: "Team Sports", anilistTag: "Team Sports", kitsuSlug: "team-sports" },
  { id: '78', englishName: "Time Travel", anilistTag: "Time Manipulation", kitsuSlug: "time-travel", aliases: ["Time Travel"] },
  { id: '79', englishName: "Video Game", anilistTag: "Video Games", kitsuSlug: "video-game", aliases: ["Video Games"] },
  { id: '80', englishName: "Visual Arts", anilistTag: "Drawing", kitsuSlug: "visual-arts" },
  { id: '81', englishName: "Crossdressing", anilistTag: "Crossdressing", kitsuSlug: "crossdressing" },
];

function normalizeGenreValue(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const CATALOG_BY_ID = new Map(
  ANIME_GENRE_CATALOG.map((entry) => [entry.id, entry]),
);

const CATALOG_BY_NAME = new Map<string, AnimeGenreCatalogEntry>();

for (const entry of ANIME_GENRE_CATALOG) {
  const names = [
    entry.englishName,
    entry.anilistGenre,
    entry.anilistTag,
    entry.kitsuSlug,
    ...(entry.aliases ?? []),
  ].filter((value): value is string => Boolean(value));

  for (const name of names) {
    CATALOG_BY_NAME.set(normalizeGenreValue(name), entry);
  }
}

export function findAnimeGenreById(
  id: string | number,
): AnimeGenreCatalogEntry | undefined {
  return CATALOG_BY_ID.get(String(id));
}

export function findAnimeGenreByName(
  name: string,
): AnimeGenreCatalogEntry | undefined {
  return CATALOG_BY_NAME.get(normalizeGenreValue(name));
}

export function toJikanGenreResource(
  name: string,
): JikanGenreResource | null {
  const entry = findAnimeGenreByName(name);

  if (!entry) {
    return null;
  }

  return {
    mal_id: Number(entry.id),
    name: entry.englishName,
  };
}

export function getStaticJikanGenres(): JikanGenreResource[] {
  return ANIME_GENRE_CATALOG.map((entry) => ({
    mal_id: Number(entry.id),
    name: entry.englishName,
  }));
}
