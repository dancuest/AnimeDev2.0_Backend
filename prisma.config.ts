<<<<<<< HEAD
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
=======
services:
  db:
    image: postgres:16
    container_name: animedev_db
    restart: unless-stopped
    environment:
      POSTGRES_USER: animedev
      POSTGRES_PASSWORD: animedev
      POSTGRES_DB: animedev
    ports:
      - "5433:5432"
    volumes:
      - animedev_pg:/var/lib/postgresql/data

volumes:
  animedev_pg:
>>>>>>> 906a70d (Configurar base tecnica del backend)
