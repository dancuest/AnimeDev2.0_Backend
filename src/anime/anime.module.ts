import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
// Este archivo pertenece al módulo de anime y se encarga de manejar la información de los animes, ya sea para listarlos, filtrarlos o enriquecerlos.


import { AnimeController } from './anime.controller';
import { AnimeMapper } from './anime.mapper';
import { AnimeService } from './anime.service';
import { GenresController } from './genres.controller';
import { AniListProvider } from './providers/anilist.provider';
import { JikanProvider } from './providers/jikan.provider';
import { KitsuProvider } from './providers/kitsu.provider';

@Module({
  imports: [HttpModule],
  controllers: [AnimeController, GenresController],
  providers: [
    AnimeService,
    AnimeMapper,
    AniListProvider,
    JikanProvider,
    KitsuProvider,
  ],
  exports: [AnimeService],
})
export class AnimeModule {}
