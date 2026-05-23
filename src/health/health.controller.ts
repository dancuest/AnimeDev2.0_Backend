import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthResponseDto } from './dto/health-response.dto';

@ApiTags('health')
@Controller('health')
export class HealthController {
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