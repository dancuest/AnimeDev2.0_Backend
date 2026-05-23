import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { TriviaController } from './trivia.controller';
import { TriviaService } from './trivia.service';

@Module({
  imports: [PrismaModule],
  controllers: [TriviaController],
  providers: [TriviaService],
  exports: [TriviaService],
})
export class TriviaModule { }