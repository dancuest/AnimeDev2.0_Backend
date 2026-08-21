-- Caché persistente para mantener el catálogo disponible cuando fallen
-- AniList, Jikan o Kitsu. IF NOT EXISTS permite aplicar esta versión incluso
-- si se alcanzó a crear la tabla con el paquete anterior.

CREATE TABLE IF NOT EXISTS "AnimeApiCache" (
    "key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'unknown',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimeApiCache_pkey" PRIMARY KEY ("key")
);

CREATE INDEX IF NOT EXISTS "AnimeApiCache_updatedAt_idx"
ON "AnimeApiCache"("updatedAt");
