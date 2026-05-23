import { Module } from '@nestjs/common';

@Module({
  imports: [PrismaModule, AnimeModule],
  controllers: [RecommendationsController],
  providers: [RecommendationsService],
  exports: [RecommendationsService],
})
export class RecommendationsModule {}
