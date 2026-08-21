import { Module } from '@nestjs/common';
import { RecommendationsService } from './recommendations.service';
import { RecommendationsController } from './recommendations.controller';
import { AnimeModule } from '../anime/anime.module';
import { PrismaModule } from '../../prisma/prisma.module';
// Este archivo forma parte del motor de recomendaciones. Aquí se define cómo se interpreta el comportamiento del usuario para sugerir contenido más útil.


@Module({
    // Aquí conecto las piezas que necesita el recomendador.
    // Prisma me da las interacciones y preferencias, y AnimeModule me da los datos de los animes que luego ordeno.
    imports: [PrismaModule, AnimeModule],
    controllers: [RecommendationsController],
    providers: [RecommendationsService],
    exports: [RecommendationsService],
})
export class RecommendationsModule { }
