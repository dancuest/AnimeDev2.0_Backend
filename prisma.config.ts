import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';
// Este archivo forma parte de la estructura del proyecto y ayuda a organizar una funcionalidad concreta del backend.


export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
