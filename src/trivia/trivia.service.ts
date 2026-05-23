import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  TriviaQuestion,
  TriviaQuestionSource,
  TriviaQuestionStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BulkImportTriviaQuestionDto } from './dto/bulk-import-trivia-question.dto';
import { CreateTriviaQuestionDto } from './dto/create-trivia-question.dto';
import { QueryTriviaQuestionDto } from './dto/query-trivia-question.dto';

@Injectable()
export class TriviaService {
  constructor(private readonly prisma: PrismaService) { }

  async getApprovedQuestions(animeId: number, query: QueryTriviaQuestionDto) {
    this.validateAnimeId(animeId);

    const where: Prisma.TriviaQuestionWhereInput = {
      animeId,
      status: TriviaQuestionStatus.APPROVED,
      ...(query.difficulty ? { difficulty: query.difficulty } : {}),
    };

    const questions = await this.prisma.triviaQuestion.findMany({
      where,
      orderBy: [
        { source: 'asc' },
        { createdAt: 'desc' },
      ],
      take: query.limit ?? 10,
    });

    return {
      data: questions.map((question) => this.toResponse(question)),
      meta: {
        count: questions.length,
      },
    };
  }

  async submitQuestion(
    userId: string,
    animeId: number,
    dto: CreateTriviaQuestionDto,
  ) {
    this.validateAnimeId(animeId);
    this.validateQuestionPayload(dto);

    const created = await this.prisma.triviaQuestion.create({
      data: {
        animeId,
        externalAnimeId: dto.externalAnimeId,
        question: dto.question,
        options: dto.options,
        correctAnswerIndex: dto.correctAnswerIndex,
        explanation: dto.explanation,
        difficulty: dto.difficulty,
        category: dto.category ?? 'GENERAL',
        status: TriviaQuestionStatus.PENDING,
        source: TriviaQuestionSource.USER_SUBMITTED,
        createdByUserId: userId,
      },
    });

    return {
      success: true,
      message: 'Pregunta enviada para revisión.',
      data: this.toResponse(created),
    };
  }

  async createOfficialQuestion(
    userId: string,
    userRole: UserRole,
    animeId: number,
    dto: CreateTriviaQuestionDto,
  ) {
    this.ensureCanModerate(userRole);
    this.validateAnimeId(animeId);
    this.validateQuestionPayload(dto);

    const created = await this.prisma.triviaQuestion.create({
      data: {
        animeId,
        externalAnimeId: dto.externalAnimeId,
        question: dto.question,
        options: dto.options,
        correctAnswerIndex: dto.correctAnswerIndex,
        explanation: dto.explanation,
        difficulty: dto.difficulty,
        category: dto.category ?? 'GENERAL',
        status: TriviaQuestionStatus.APPROVED,
        source: TriviaQuestionSource.OFFICIAL,
        createdByUserId: userId,
        reviewedByUserId: userId,
        reviewedAt: new Date(),
      },
    });

    return {
      success: true,
      message: 'Pregunta oficial creada y aprobada.',
      data: this.toResponse(created),
    };
  }

  async bulkImportOfficialQuestions(
    userId: string,
    userRole: UserRole,
    dto: BulkImportTriviaQuestionDto,
  ) {
    this.ensureCanModerate(userRole);

    const normalizedQuestions = dto.questions.map((question, index) => {
      this.validateAnimeId(question.animeId);
      this.validateQuestionPayload(question);

      return {
        row: index + 1,
        animeId: question.animeId,
        externalAnimeId: question.externalAnimeId ?? question.animeId.toString(),
        question: question.question.trim(),
        options: question.options.map((option) => option.trim()),
        correctAnswerIndex: question.correctAnswerIndex,
        explanation: question.explanation?.trim() || null,
        difficulty: question.difficulty,
        category: question.category ?? 'GENERAL',
      };
    });

    const duplicatedInsidePayload = this.findDuplicatedQuestionsInPayload(
      normalizedQuestions,
    );

    if (duplicatedInsidePayload.length > 0) {
      throw new BadRequestException({
        message: 'El lote contiene preguntas duplicadas.',
        duplicatedQuestions: duplicatedInsidePayload,
      });
    }

    const existingQuestions = await this.prisma.triviaQuestion.findMany({
      where: {
        OR: normalizedQuestions.map((question) => ({
          animeId: question.animeId,
          question: {
            equals: question.question,
            mode: 'insensitive',
          },
        })),
      },
      select: {
        animeId: true,
        question: true,
      },
    });

    const existingKeys = new Set(
      existingQuestions.map((question) =>
        this.buildQuestionKey(question.animeId, question.question),
      ),
    );

    const questionsToCreate = normalizedQuestions.filter((question) => {
      const key = this.buildQuestionKey(question.animeId, question.question);
      return !existingKeys.has(key);
    });

    if (questionsToCreate.length === 0) {
      return {
        success: true,
        message: 'No se importaron preguntas nuevas porque todas ya existían.',
        meta: {
          received: normalizedQuestions.length,
          imported: 0,
          skipped: normalizedQuestions.length,
        },
        data: [],
      };
    }

    const created = await this.prisma.$transaction(
      questionsToCreate.map((question) =>
        this.prisma.triviaQuestion.create({
          data: {
            animeId: question.animeId,
            externalAnimeId: question.externalAnimeId,
            question: question.question,
            options: question.options,
            correctAnswerIndex: question.correctAnswerIndex,
            explanation: question.explanation,
            difficulty: question.difficulty,
            category: question.category,
            status: TriviaQuestionStatus.APPROVED,
            source: TriviaQuestionSource.OFFICIAL,
            createdByUserId: userId,
            reviewedByUserId: userId,
            reviewedAt: new Date(),
          },
        }),
      ),
    );

    return {
      success: true,
      message: `Importación completada. Preguntas nuevas: ${created.length}. Omitidas por duplicado: ${normalizedQuestions.length - created.length
        }.`,
      meta: {
        received: normalizedQuestions.length,
        imported: created.length,
        skipped: normalizedQuestions.length - created.length,
      },
      data: created.map((question) => this.toResponse(question)),
    };
  }

  async listMyQuestions(userId: string, query: QueryTriviaQuestionDto) {
    const questions = await this.prisma.triviaQuestion.findMany({
      where: {
        createdByUserId: userId,
        ...(query.difficulty ? { difficulty: query.difficulty } : {}),
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: query.limit ?? 20,
    });

    return {
      data: questions.map((question) => this.toResponse(question)),
      meta: {
        count: questions.length,
      },
    };
  }

  async listPendingQuestions(userRole: UserRole, query: QueryTriviaQuestionDto) {
    this.ensureCanModerate(userRole);

    const questions = await this.prisma.triviaQuestion.findMany({
      where: {
        status: TriviaQuestionStatus.PENDING,
        ...(query.difficulty ? { difficulty: query.difficulty } : {}),
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: query.limit ?? 20,
    });

    return {
      data: questions.map((question) => this.toResponse(question)),
      meta: {
        count: questions.length,
      },
    };
  }

  async approveQuestion(userId: string, userRole: UserRole, questionId: string) {
    this.ensureCanModerate(userRole);

    const existing = await this.findQuestionOrThrow(questionId);

    if (existing.status === TriviaQuestionStatus.APPROVED) {
      return {
        success: true,
        message: 'La pregunta ya estaba aprobada.',
        data: this.toResponse(existing),
      };
    }

    const updated = await this.prisma.triviaQuestion.update({
      where: {
        id: questionId,
      },
      data: {
        status: TriviaQuestionStatus.APPROVED,
        reviewedByUserId: userId,
        reviewedAt: new Date(),
      },
    });

    return {
      success: true,
      message: 'Pregunta aprobada correctamente.',
      data: this.toResponse(updated),
    };
  }

  async rejectQuestion(userId: string, userRole: UserRole, questionId: string) {
    this.ensureCanModerate(userRole);

    const existing = await this.findQuestionOrThrow(questionId);

    if (existing.status === TriviaQuestionStatus.REJECTED) {
      return {
        success: true,
        message: 'La pregunta ya estaba rechazada.',
        data: this.toResponse(existing),
      };
    }

    const updated = await this.prisma.triviaQuestion.update({
      where: {
        id: questionId,
      },
      data: {
        status: TriviaQuestionStatus.REJECTED,
        reviewedByUserId: userId,
        reviewedAt: new Date(),
      },
    });

    return {
      success: true,
      message: 'Pregunta rechazada correctamente.',
      data: this.toResponse(updated),
    };
  }

  private async findQuestionOrThrow(questionId: string) {
    const question = await this.prisma.triviaQuestion.findUnique({
      where: {
        id: questionId,
      },
    });

    if (!question) {
      throw new NotFoundException('Pregunta de trivia no encontrada.');
    }

    return question;
  }

  private validateAnimeId(animeId: number) {
    if (!Number.isInteger(animeId) || animeId <= 0) {
      throw new BadRequestException('animeId debe ser un número entero positivo.');
    }
  }

  private validateQuestionPayload(dto: {
    question: string;
    options: string[];
    correctAnswerIndex: number;
  }) {
    if (!dto.options || dto.options.length !== 4) {
      throw new BadRequestException('La pregunta debe tener exactamente 4 opciones.');
    }

    const cleanQuestion = dto.question.trim();

    if (cleanQuestion.length < 10) {
      throw new BadRequestException('La pregunta debe tener mínimo 10 caracteres.');
    }

    const normalizedOptions = dto.options.map((option) => option.trim().toLowerCase());
    const uniqueOptions = new Set(normalizedOptions);

    if (uniqueOptions.size !== dto.options.length) {
      throw new BadRequestException('Las opciones no pueden estar repetidas.');
    }

    const selectedOption = dto.options[dto.correctAnswerIndex];

    if (!selectedOption || selectedOption.trim().length === 0) {
      throw new BadRequestException('El índice de respuesta correcta no apunta a una opción válida.');
    }

    const questionAsOption = normalizedOptions.includes(cleanQuestion.toLowerCase());

    if (questionAsOption) {
      throw new BadRequestException('La pregunta no puede repetirse como una opción de respuesta.');
    }
  }

  private ensureCanModerate(userRole: UserRole) {
    if (userRole !== UserRole.ADMIN && userRole !== UserRole.MODERATOR) {
      throw new ForbiddenException('No tienes permisos para moderar preguntas de trivia.');
    }
  }

  private findDuplicatedQuestionsInPayload(
    questions: Array<{
      row: number;
      animeId: number;
      question: string;
    }>,
  ) {
    const seen = new Map<string, number>();
    const duplicated: Array<{
      question: string;
      animeId: number;
      firstRow: number;
      duplicatedRow: number;
    }> = [];

    for (const item of questions) {
      const key = this.buildQuestionKey(item.animeId, item.question);
      const firstRow = seen.get(key);

      if (firstRow) {
        duplicated.push({
          question: item.question,
          animeId: item.animeId,
          firstRow,
          duplicatedRow: item.row,
        });
      } else {
        seen.set(key, item.row);
      }
    }

    return duplicated;
  }

  private buildQuestionKey(animeId: number, question: string) {
    return `${animeId}:${question.trim().toLowerCase()}`;
  }

  private toResponse(question: TriviaQuestion) {
    return {
      id: question.id,
      animeId: question.animeId,
      externalAnimeId: question.externalAnimeId,
      question: question.question,
      options: this.normalizeOptions(question.options),
      correctAnswerIndex: question.correctAnswerIndex,
      explanation: question.explanation,
      difficulty: question.difficulty,
      category: question.category,
      status: question.status,
      source: question.source,
      createdByUserId: question.createdByUserId,
      reviewedByUserId: question.reviewedByUserId,
      createdAt: question.createdAt,
      updatedAt: question.updatedAt,
      reviewedAt: question.reviewedAt,
    };
  }

  private normalizeOptions(options: Prisma.JsonValue): string[] {
    if (!Array.isArray(options)) {
      return [];
    }

    return options
      .filter((option): option is string => typeof option === 'string')
      .map((option) => option.trim());
  }
}