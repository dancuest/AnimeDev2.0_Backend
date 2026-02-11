# AnimeDev Backend

Backend API for the AnimeDev Android app (NestJS + Jikan v4).

## Requisitos

- Node.js 18+
- npm

## Instalación

```bash
npm install
```

## Variables de entorno

Copia el archivo de ejemplo y ajusta según sea necesario:

```bash
cp .env.example .env
```

| Variable | Descripción | Default |
| --- | --- | --- |
| `PORT` | Puerto HTTP del API | `3000` |
| `JIKAN_BASE_URL` | Base URL de Jikan v4 | `https://api.jikan.moe/v4` |
| `CACHE_TTL_SECONDS` | TTL en segundos para cache (top + detail) | `600` |

## Ejecutar en local

```bash
npm run start:dev
```

Swagger estará disponible en: `http://localhost:3000/docs`

## Endpoints

### Health

```bash
curl http://localhost:3000/health
```

### Top anime

```bash
curl "http://localhost:3000/anime/top?limit=10"
```

### Buscar anime

```bash
curl "http://localhost:3000/anime/search?q=naruto&limit=10"
```

### Detalle de anime

```bash
curl "http://localhost:3000/anime/1"
```

## Respuesta estándar

```json
{
  "data": "...",
  "meta": "..."
}
```

## Notas

- Los datos se normalizan desde Jikan a un DTO estable para el móvil.
- No se exponen episodios ni listas de capítulos (solo `totalEpisodes` si está disponible).
- `mangaPlusUrl` apunta a una búsqueda en MangaPlus usando el título del anime.
