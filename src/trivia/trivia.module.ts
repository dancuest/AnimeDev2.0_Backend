import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { TriviaController } from './trivia.controller';
import { TriviaService } from './trivia.service';
// Aquí está la lógica del módulo de trivia, donde se crean, consultan y gestionan las preguntas del juego.


@Module({
  imports: [PrismaModule],
  controllers: [TriviaController],
  providers: [TriviaService],
  exports: [TriviaService],
})
export class TriviaModule { }