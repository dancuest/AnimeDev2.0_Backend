import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { InteractionsController } from './interactions.controller';
import { InteractionsService } from './interactions.service';
// Este archivo gestiona las interacciones del usuario con el contenido, algo clave para construir el historial y alimentar las recomendaciones.


@Module({
  imports: [PrismaModule],
  controllers: [InteractionsController],
  providers: [InteractionsService],
  exports: [InteractionsService],
})
export class InteractionsModule {}