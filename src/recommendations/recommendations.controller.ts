import {
  Controller,
  Get,
  Req,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { RecommendationsService } from './recommendations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RecommendationsResponseDto } from './dto/recommendations-swagger.dto';

@ApiTags('recomendaciones')
@ApiBearerAuth('access-token')
@Controller('recommendations')
export class RecommendationsController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
  ) { }

  @UseGuards(JwtAuthGuard)
  @Get('adaptive')
  @ApiOperation({
    summary:
      'Obtener recomendaciones adaptativas usando similitud del coseno y señales de preferencia',
  })
  @ApiOkResponse({
    type: RecommendationsResponseDto,
    description:
      'Retorna recomendaciones personalizadas de anime junto con la estrategia utilizada.',
  })
  @ApiUnauthorizedResponse({
    description: 'El token Bearer es inexistente o inválido.',
  })
  async getAdaptiveRecommendations(
    @Req() req: Request & { user?: { userId: string } },
  ) {
    const userId = req.user?.userId;

    if (!userId) {
      throw new HttpException(
        'Usuario no encontrado en la solicitud',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const requestId = (req as any).requestId;

    return this.recommendationsService.getAdaptiveRecommendations(
      userId,
      requestId,
    );
  }
}