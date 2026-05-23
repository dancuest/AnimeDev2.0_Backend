import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Post,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateInteractionDto } from './dto/create-interaction.dto';
import { InteractionsService } from './interactions.service';
import {
  InteractionCreateResponseDto,
  InteractionRecordResponseDto,
} from './dto/interactions-swagger.dto';

@ApiTags('interacciones')
@ApiBearerAuth('access-token')
@Controller('interactions')
@UseGuards(JwtAuthGuard)
export class InteractionsController {
  constructor(private readonly interactionsService: InteractionsService) { }

  @Post()
  @ApiOperation({ summary: 'Registrar una interacción del usuario con un anime' })
  @ApiCreatedResponse({
    type: InteractionCreateResponseDto,
    description: 'Retorna la confirmación junto con la interacción almacenada.',
  })
  @ApiBadRequestResponse({
    description:
      'La validación de los datos falló o la carga útil no coincide con el tipo de interacción.',
  })
  @ApiUnauthorizedResponse({
    description: 'El token Bearer es inexistente o inválido.',
  })
  create(
    @Req() req: Request & { user?: { userId: string } },
    @Body() dto: CreateInteractionDto,
  ) {
    return this.interactionsService.create(req.user!.userId, dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'Listar las interacciones del usuario actual' })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: 50,
    description: 'Cantidad máxima de interacciones a retornar',
  })
  @ApiOkResponse({
    type: InteractionRecordResponseDto,
    isArray: true,
    description:
      'Retorna las interacciones del usuario actual ordenadas por recencia.',
  })
  @ApiUnauthorizedResponse({
    description: 'El token Bearer es inexistente o inválido.',
  })
  listMine(
    @Req() req: Request & { user?: { userId: string } },
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.interactionsService.listMine(req.user!.userId, limit);
  }
}