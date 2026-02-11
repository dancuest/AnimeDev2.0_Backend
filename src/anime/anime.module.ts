import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { AnimeController } from './anime.controller';
import { GenresController } from './genres.controller';
import { AnimeMapper } from './anime.mapper';
import { AnimeService } from './anime.service';

@Module({
  imports: [HttpModule],
  controllers: [AnimeController, GenresController],
  providers: [AnimeService, AnimeMapper],
})
export class AnimeModule {}
