import { Module } from '@nestjs/common';
<<<<<<< HEAD
import { PrismaModule } from '../../prisma/prisma.module';
import { InteractionsController } from './interactions.controller';
import { InteractionsService } from './interactions.service';

@Module({
  imports: [PrismaModule],
  controllers: [InteractionsController],
  providers: [InteractionsService],
})
=======

@Module({})
>>>>>>> 906a70d (Configurar base tecnica del backend)
export class InteractionsModule {}
