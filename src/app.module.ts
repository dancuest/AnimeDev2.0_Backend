import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from '../config/configuration';
import { validateEnvironment } from '../config/env.validation';
import { AnimeModule } from './anime/anime.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnvironment,
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: () => ({
        ttl: Number(process.env.CACHE_TTL_SECONDS ?? 600),
      }),
    }),
    HealthModule,
    AnimeModule,
  ],
})
export class AppModule {}
