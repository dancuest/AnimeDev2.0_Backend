import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
// Este módulo registra los controladores y servicios de una parte del sistema para que Nest pueda montarlos correctamente.


@Module({
  controllers: [HealthController],
})
export class HealthModule {}
