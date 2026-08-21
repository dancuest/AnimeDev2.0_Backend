import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
// Este módulo registra los controladores y servicios de una parte del sistema para que Nest pueda montarlos correctamente.


@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}