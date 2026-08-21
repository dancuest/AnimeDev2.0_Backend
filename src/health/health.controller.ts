import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthResponseDto } from './dto/health-response.dto';
// Este archivo define los endpoints de salud del backend, útiles para verificar que el servicio está vivo y respondiendo.


@ApiTags('health')
@Controller('health')
export class HealthController {
  // Este endpoint me sirve para comprobar que el servicio sigue vivo.
  // En desarrollo lo uso como prueba rápida de que la API respondió.
  @Get()
  @ApiOperation({ summary: 'Endpoint de verificación del estado del servicio' })
  @ApiOkResponse({
    type: HealthResponseDto,
    description: 'Retorna el estado del backend.',
  })
  getHealth() {
    return {
      status: 'ok',
      service: 'animedev-backend',
    };
  }
}