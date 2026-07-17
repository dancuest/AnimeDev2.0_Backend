// Este archivo forma parte de la estructura del proyecto y ayuda a organizar una funcionalidad concreta del backend.

export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),

  jikanBaseUrl:
    process.env.JIKAN_BASE_URL ?? 'https://api.jikan.moe/v4',

  anilistBaseUrl:
    process.env.ANILIST_BASE_URL ?? 'https://graphql.anilist.co',

  kitsuBaseUrl:
    process.env.KITSU_BASE_URL ?? 'https://kitsu.io/api/edge',

  animeProviderOrder:
    process.env.ANIME_PROVIDER_ORDER ?? 'anilist,jikan,kitsu',

  cacheTtlMs:
    parseInt(process.env.CACHE_TTL_SECONDS ?? '600', 10) * 1000,

  shortCacheTtlMs:
    parseInt(process.env.SHORT_CACHE_TTL_SECONDS ?? '60', 10) * 1000,

  translateSynopses: process.env.TRANSLATE_SYNOPSES !== 'false',

  translationBaseUrl:
    process.env.TRANSLATION_BASE_URL ??
    'https://api.mymemory.translated.net/get',

  translationEmail: process.env.TRANSLATION_EMAIL || undefined,
});
