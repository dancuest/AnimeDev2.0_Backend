import { Module } from '@nestjs/common';
import { AnimeModule } from '../../anime/anime.module';
import { TriviaAdminController } from './trivia-admin.controller';
import { TriviaAdminService } from './trivia-admin.service';
// Este módulo arma el sub-sistema de administración de trivia.
// Une el controlador, el servicio y el módulo de anime para que el flujo de preguntas y reportes funcione de manera ordenada.

@Module({
    imports: [AnimeModule],
    controllers: [TriviaAdminController],
    providers: [TriviaAdminService],
    exports: [TriviaAdminService],
})
export class TriviaAdminModule { }