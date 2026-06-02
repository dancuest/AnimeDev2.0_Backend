import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import configuration from '../config/configuration';
import { validateEnvironment } from '../config/env.validation';
import { PrismaModule } from '../prisma/prisma.module';
import { AnimeModule } from './anime/anime.module';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { InteractionsModule } from './interactions/interactions.module';
import { TriviaAdminModule } from './modules/trivia-admin/trivia-admin.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { TriviaModule } from './trivia/trivia.module';
import { UsersModule } from './users/users.module';

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
        ttl: config.get('cacheTtlMs') ?? 600_000,
      }),
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    HealthModule,
    AnimeModule,
    RecommendationsModule,
    InteractionsModule,
    TriviaModule,
    TriviaAdminModule,
  ],
  controllers: [AppController],
})
export class AppModule {}