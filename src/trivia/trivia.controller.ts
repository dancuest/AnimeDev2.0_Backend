import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateTriviaQuestionDto } from './dto/create-trivia-question.dto';
import { QueryTriviaQuestionDto } from './dto/query-trivia-question.dto';
import {
  TriviaQuestionListResponseDto,
  TriviaQuestionMutationResponseDto,
} from './dto/trivia-question-response.dto';
import { TriviaService } from './trivia.service';

type AuthenticatedRequest = Request & {
  user?: {
    userId: string;
    role: UserRole;
  };
};

@ApiTags('trivia')
@Controller('trivia')
export class TriviaController {
  constructor(private readonly triviaService: TriviaService) { }

  @Get('anime/:animeId/questions')
  @ApiOperation({
    summary: 'Obtener preguntas aprobadas para un anime',
    description:
      'Retorna únicamente preguntas aprobadas. Estas son las preguntas que puede consumir la app para jugar.',
  })
  @ApiParam({
    name: 'animeId',
    example: 21,
    description: 'Identificador numérico del anime.',
  })
  @ApiOkResponse({
    type: TriviaQuestionListResponseDto,
    description: 'Listado de preguntas aprobadas para el anime.',
  })
  @ApiBadRequestResponse({
    description: 'animeId inválido o query inválida.',
  })
  getApprovedQuestions(
    @Param('animeId', ParseIntPipe) animeId: number,
    @Query() query: QueryTriviaQuestionDto,
  ) {
    return this.triviaService.getApprovedQuestions(animeId, query);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Post('anime/:animeId/questions')
  @ApiOperation({
    summary: 'Enviar una pregunta colaborativa para revisión',
    description:
      'Permite que un usuario registrado proponga una pregunta. La pregunta queda en estado PENDING hasta ser revisada.',
  })
  @ApiParam({
    name: 'animeId',
    example: 21,
  })
  @ApiCreatedResponse({
    type: TriviaQuestionMutationResponseDto,
    description: 'Pregunta enviada para revisión.',
  })
  @ApiBadRequestResponse({
    description: 'Payload inválido.',
  })
  @ApiUnauthorizedResponse({
    description: 'Token inexistente o inválido.',
  })
  submitQuestion(
    @Req() req: AuthenticatedRequest,
    @Param('animeId', ParseIntPipe) animeId: number,
    @Body() dto: CreateTriviaQuestionDto,
  ) {
    return this.triviaService.submitQuestion(req.user!.userId, animeId, dto);
  }


  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Get('me/questions')
  @ApiOperation({
    summary: 'Listar preguntas enviadas por el usuario actual',
  })
  @ApiOkResponse({
    type: TriviaQuestionListResponseDto,
    description: 'Listado de preguntas creadas por el usuario actual.',
  })
  @ApiUnauthorizedResponse({
    description: 'Token inexistente o inválido.',
  })
  listMyQuestions(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryTriviaQuestionDto,
  ) {
    return this.triviaService.listMyQuestions(req.user!.userId, query);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Get('pending')
  @ApiOperation({
    summary: 'Listar preguntas pendientes de revisión',
    description:
      'Solo disponible para usuarios con rol ADMIN o MODERATOR.',
  })
  @ApiOkResponse({
    type: TriviaQuestionListResponseDto,
    description: 'Listado de preguntas pendientes.',
  })
  @ApiUnauthorizedResponse({
    description: 'Token inexistente o inválido.',
  })
  @ApiForbiddenResponse({
    description: 'El usuario no tiene permisos de moderación.',
  })
  listPendingQuestions(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryTriviaQuestionDto,
  ) {
    return this.triviaService.listPendingQuestions(req.user!.role, query);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Post('anime/:animeId/official')
  @ApiOperation({
    summary: 'Crear pregunta oficial aprobada',
    description:
      'Solo ADMIN o MODERATOR pueden crear preguntas oficiales que quedan aprobadas inmediatamente.',
  })
  @ApiParam({
    name: 'animeId',
    example: 21,
  })
  @ApiCreatedResponse({
    type: TriviaQuestionMutationResponseDto,
    description: 'Pregunta oficial creada y aprobada.',
  })
  @ApiUnauthorizedResponse({
    description: 'Token inexistente o inválido.',
  })
  @ApiForbiddenResponse({
    description: 'El usuario no tiene permisos de moderación.',
  })
  createOfficialQuestion(
    @Req() req: AuthenticatedRequest,
    @Param('animeId', ParseIntPipe) animeId: number,
    @Body() dto: CreateTriviaQuestionDto,
  ) {
    return this.triviaService.createOfficialQuestion(
      req.user!.userId,
      req.user!.role,
      animeId,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Patch('questions/:id/approve')
  @ApiOperation({
    summary: 'Aprobar una pregunta pendiente',
    description:
      'Solo ADMIN o MODERATOR pueden aprobar preguntas colaborativas.',
  })
  @ApiOkResponse({
    type: TriviaQuestionMutationResponseDto,
    description: 'Pregunta aprobada correctamente.',
  })
  @ApiUnauthorizedResponse({
    description: 'Token inexistente o inválido.',
  })
  @ApiForbiddenResponse({
    description: 'El usuario no tiene permisos de moderación.',
  })
  approveQuestion(
    @Req() req: AuthenticatedRequest,
    @Param('id') questionId: string,
  ) {
    return this.triviaService.approveQuestion(
      req.user!.userId,
      req.user!.role,
      questionId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Patch('questions/:id/reject')
  @ApiOperation({
    summary: 'Rechazar una pregunta pendiente',
    description:
      'Solo ADMIN o MODERATOR pueden rechazar preguntas colaborativas.',
  })
  @ApiOkResponse({
    type: TriviaQuestionMutationResponseDto,
    description: 'Pregunta rechazada correctamente.',
  })
  @ApiUnauthorizedResponse({
    description: 'Token inexistente o inválido.',
  })
  @ApiForbiddenResponse({
    description: 'El usuario no tiene permisos de moderación.',
  })
  rejectQuestion(
    @Req() req: AuthenticatedRequest,
    @Param('id') questionId: string,
  ) {
    return this.triviaService.rejectQuestion(
      req.user!.userId,
      req.user!.role,
      questionId,
    );
  }
}