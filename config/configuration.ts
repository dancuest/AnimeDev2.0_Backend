export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  jikanBaseUrl: process.env.JIKAN_BASE_URL ?? 'https://api.jikan.moe/v4',
  cacheTtlMs: parseInt(process.env.CACHE_TTL_SECONDS ?? '600', 10) * 1000,
  shortCacheTtlMs: parseInt(process.env.SHORT_CACHE_TTL_SECONDS ?? '60', 10) * 1000,
});