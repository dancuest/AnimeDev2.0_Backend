import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        // Preferimos segundos (estándar). Si solo hay ms, convertimos.
        const ttlSecondsRaw = config.get<number>('cacheTtlSeconds');
        if (typeof ttlSecondsRaw === 'number' && Number.isFinite(ttlSecondsRaw) && ttlSecondsRaw > 0) {
          return { ttl: Math.floor(ttlSecondsRaw) };
        }

        const ttlMsRaw = config.get<number>('cacheTtlMs');
        if (typeof ttlMsRaw === 'number' && Number.isFinite(ttlMsRaw) && ttlMsRaw > 0) {
          return { ttl: Math.max(1, Math.ceil(ttlMsRaw / 1000)) };
        }

        return { ttl: 600 }; // 10 min default
      },
    }),
    HealthModule,
    AnimeModule,
  ],
})
export class AppModule {}
