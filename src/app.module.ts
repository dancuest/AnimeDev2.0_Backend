import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import configuration from '../config/configuration';
import { validateEnvironment } from '../config/env.validation';
import { UsersModule } from './users/users.module';
import { AnimeModule } from './anime/anime.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { InteractionsModule } from './interactions/interactions.module';

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
      useFactory: (config: ConfigService) => ({
        ttl: config.get<number>('cacheTtlMs') ?? 600_000,
      }),
    }),

    PrismaModule,
    AuthModule,
    UsersModule,
    HealthModule,
    AnimeModule,
    RecommendationsModule,
    InteractionsModule,
  ],
})
export class AppModule { }