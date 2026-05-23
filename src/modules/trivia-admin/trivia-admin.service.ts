import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AnimeService } from '../../anime/anime.service';
import { TriviaQuestion, TriviaQuestionStatus, TriviaCategory } from '@prisma/client';
import { BulkImportTriviaQuestionsDto } from './dto/bulk-import-trivia-question.dto';
import { CreateQuestionReportDto } from './dto/create-question-report.dto';
import { UpdateQuestionReportDto } from './dto/update-question-report.dto';
import { UpsertTriviaQuestionDto } from './dto/upsert-trivia-question.dto';

type BulkImportIssueType = 'INVALID' | 'DUPLICATE_EXISTING' | 'DUPLICATE_BATCH';

type BulkImportIssue = {
  index: number;
  type: BulkImportIssueType;
  animeId?: number | null;
  question?: string;
  reason: string;
};

@Injectable()
export class TriviaAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly animeService: AnimeService,
  ) { }

  async createQuestionReport(userId: string, dto: CreateQuestionReportDto) {
    const reason = dto.reason.trim();
    const questionText = dto.questionText.trim();

    if (reason.length < 8) {
      throw new BadRequestException('La queja debe tener al menos 8 caracteres');
    }

    if (!questionText) {
      throw new BadRequestException('La pregunta reportada es obligatoria');
    }

    return this.prisma.triviaQuestionReport.create({
      data: {
        questionId: dto.questionId,
        animeId: dto.animeId ?? null,
        animeTitle: dto.animeTitle?.trim() || null,
        questionText,
        reason,
        reporterUserId: userId,
        status: 'PENDING',
      },
    });
  }

  async listQuestionReports(userId: string, status?: string) {
    await this.assertAdmin(userId);

    const where =
      status && status !== 'ALL'
        ? { status }
        : {};

    return this.prisma.triviaQuestionReport.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });
  }

  async updateQuestionReport(
    userId: string,
    reportId: string,
    dto: UpdateQuestionReportDto,
  ) {
    await this.assertAdmin(userId);

    const existing = await this.prisma.triviaQuestionReport.findUnique({
      where: { id: reportId },
    });

    if (!existing) {
      throw new NotFoundException('Queja no encontrada');
    }

    const nextStatus = dto.status ?? existing.status;
    const isClosing = ['RESOLVED', 'REJECTED', 'DELETED'].includes(nextStatus);

    return this.prisma.triviaQuestionReport.update({
      where: { id: reportId },
      data: {
        status: nextStatus,
        adminNote: dto.adminNote?.trim() || existing.adminNote,
        resolvedByUserId: isClosing ? userId : existing.resolvedByUserId,
        resolvedAt: isClosing ? new Date() : existing.resolvedAt,
      },
    });
  }

  async listQuestionsForAdmin(userId: string, status?: string) {
    await this.assertAdmin(userId);

    const where =
      status && status !== 'ALL'
        ? { status: status as unknown as TriviaQuestionStatus }
        : {};

    const questions = await this.prisma.triviaQuestion.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      take: 200,
    });

    return this.withAnimeTitles(questions);
  }

  async getQuestionById(userId: string, questionId: string) {
    await this.assertAdmin(userId);

    const question = await this.prisma.triviaQuestion.findUnique({
      where: {
        id: questionId,
      },
    });

    if (!question) {
      throw new NotFoundException('Pregunta no encontrada');
    }

    const [enrichedQuestion] = await this.withAnimeTitles([question]);

    return enrichedQuestion;
  }

  async searchAnime(userId: string, query: string) {
    await this.assertAdmin(userId);

    const q = query?.trim();

    if (!q || q.length < 2) {
      return [];
    }

    try {
      const result = await this.animeService.search(q, 20);

      return result.data.map((anime) => ({
        id: anime.id,
        externalApiId: anime.externalApiId,
        title: anime.title,
        originalTitle: anime.originalTitle,
        coverImageUrl: anime.coverImageUrl,
        totalEpisodes: anime.totalEpisodes,
        releaseYear: anime.releaseYear,
      }));
    } catch (error) {
      console.warn(
        `[TriviaAdminService] No fue posible buscar anime en proveedor externo. query="${q}"`,
        error,
      );

      return [];
    }
  }

  async listQuestionsByAnime(userId: string, animeId: number) {
    await this.assertAdmin(userId);

    if (!animeId || animeId <= 0) {
      throw new BadRequestException('animeId inválido');
    }

    const questions = await this.prisma.triviaQuestion.findMany({
      where: {
        animeId,
      },
      orderBy: [
        {
          difficulty: 'asc',
        },
        {
          createdAt: 'desc',
        },
      ],
    });

    return this.withAnimeTitles(questions);
  }

  async createQuestionAsAdmin(userId: string, dto: UpsertTriviaQuestionDto) {
    await this.assertAdmin(userId);

    this.validateQuestionPayload(dto, true);

    const randomized = this.moveCorrectAnswerToBalancedPosition(
      dto.options!,
      dto.correctAnswerIndex!,
      this.randomIndexFromText(dto.question!),
    );

    const created = await this.prisma.triviaQuestion.create({
      data: {
        animeId: dto.animeId!,
        externalAnimeId: dto.externalAnimeId ?? String(dto.animeId),
        question: dto.question!.trim(),
        options: randomized.options,
        correctAnswerIndex: randomized.correctAnswerIndex,
        difficulty: dto.difficulty!,
        category: (dto.category?.trim() as unknown as TriviaCategory) || TriviaCategory.GENERAL,
        explanation: dto.explanation?.trim() || '',
        status: (dto.status as unknown as TriviaQuestionStatus) ?? TriviaQuestionStatus.APPROVED,
        source: 'OFFICIAL',
        createdByUserId: userId,
        reviewedByUserId: userId,
        reviewedAt: new Date(),
      },
    });

    const [enrichedQuestion] = await this.withAnimeTitles([created]);

    return enrichedQuestion;
  }

  async bulkImportQuestions(userId: string, dto: BulkImportTriviaQuestionsDto) {
    await this.assertAdmin(userId);

    const questions = dto.questions ?? [];

    if (!Array.isArray(questions) || questions.length === 0) {
      throw new BadRequestException('Debes enviar al menos una pregunta.');
    }

    const issues: BulkImportIssue[] = [];
    const prepared: Array<{
      index: number;
      animeId: number;
      externalAnimeId: string;
      question: string;
      options: string[];
      correctAnswerIndex: number;
      difficulty: 'EASY' | 'MEDIUM' | 'HARD';
      category: string;
      explanation: string;
      status: 'PENDING' | 'APPROVED' | 'REJECTED';
      normalizedQuestion: string;
    }> = [];

    questions.forEach((item, index) => {
      const validationError = this.validateBulkItem(item);

      if (validationError) {
        issues.push({
          index,
          type: 'INVALID',
          animeId: item?.animeId ?? null,
          question: item?.question,
          reason: validationError,
        });
        return;
      }

      const animeId = item.animeId!;
      const question = item.question.trim();
      const normalizedQuestion = this.normalizeQuestion(question);

      prepared.push({
        index,
        animeId,
        externalAnimeId: item.externalAnimeId?.trim() || String(animeId),
        question,
        options: item.options.map((option) => option.trim()),
        correctAnswerIndex: item.correctAnswerIndex,
        difficulty: item.difficulty,
        category: item.category?.trim() || 'GENERAL',
        explanation: item.explanation?.trim() || '',
        status: item.status ?? 'APPROVED',
        normalizedQuestion,
      });
    });

    const batchSeen = new Map<string, number>();
    const uniquePrepared: typeof prepared = [];

    for (const item of prepared) {
      const key = `${item.animeId}:${item.normalizedQuestion}`;

      if (batchSeen.has(key)) {
        issues.push({
          index: item.index,
          type: 'DUPLICATE_BATCH',
          animeId: item.animeId,
          question: item.question,
          reason: `Duplicada dentro del mismo lote. Ya aparece en el índice ${batchSeen.get(key)}.`,
        });
        continue;
      }

      batchSeen.set(key, item.index);
      uniquePrepared.push(item);
    }

    const animeIds = [...new Set(uniquePrepared.map((item) => item.animeId))];

    const existingQuestions = animeIds.length > 0
      ? await this.prisma.triviaQuestion.findMany({
        where: {
          animeId: {
            in: animeIds,
          },
          status: {
            not: 'REJECTED',
          },
        },
        select: {
          id: true,
          animeId: true,
          question: true,
        },
      })
      : [];

    const existingKeys = new Set(
      existingQuestions.map((question) => {
        return `${question.animeId}:${this.normalizeQuestion(question.question)}`;
      }),
    );

    const finalPrepared: typeof uniquePrepared = [];

    for (const item of uniquePrepared) {
      const key = `${item.animeId}:${item.normalizedQuestion}`;

      if (existingKeys.has(key)) {
        issues.push({
          index: item.index,
          type: 'DUPLICATE_EXISTING',
          animeId: item.animeId,
          question: item.question,
          reason: 'Ya existe una pregunta igual o equivalente para este anime.',
        });
        continue;
      }

      finalPrepared.push(item);
    }

    const createdQuestions: TriviaQuestion[] = [];

    for (let createdIndex = 0; createdIndex < finalPrepared.length; createdIndex += 1) {
      const item = finalPrepared[createdIndex];

      const targetCorrectAnswerIndex = createdIndex % 4;

      const randomized = this.moveCorrectAnswerToBalancedPosition(
        item.options,
        item.correctAnswerIndex,
        targetCorrectAnswerIndex,
      );

      const created = await this.prisma.triviaQuestion.create({
        data: {
          animeId: item.animeId,
          externalAnimeId: item.externalAnimeId,
          question: item.question,
          options: randomized.options,
          correctAnswerIndex: randomized.correctAnswerIndex,
          difficulty: item.difficulty,
          category: item.category as unknown as TriviaCategory,
          explanation: item.explanation,
          status: item.status as unknown as TriviaQuestionStatus,
          source: 'OFFICIAL',
          createdByUserId: userId,
          reviewedByUserId: item.status === 'APPROVED' ? userId : null,
          reviewedAt: item.status === 'APPROVED' ? new Date() : null,
        },
      });

      existingKeys.add(`${item.animeId}:${item.normalizedQuestion}`);
      createdQuestions.push(created);
    }

    const invalid = issues.filter((issue) => issue.type === 'INVALID').length;
    const duplicateBatch = issues.filter((issue) => issue.type === 'DUPLICATE_BATCH').length;
    const duplicateExisting = issues.filter((issue) => issue.type === 'DUPLICATE_EXISTING').length;

    const correctAnswerDistribution = createdQuestions.reduce(
      (acc, question) => {
        const key = ['A', 'B', 'C', 'D'][question.correctAnswerIndex] ?? 'UNKNOWN';
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      success: true,
      summary: {
        received: questions.length,
        created: createdQuestions.length,
        rejected: issues.length,
        invalid,
        duplicateBatch,
        duplicateExisting,
        correctAnswerDistribution,
      },
      createdQuestions,
      issues,
    };
  }

  async updateQuestion(
    userId: string,
    questionId: string,
    dto: UpsertTriviaQuestionDto,
  ) {
    await this.assertAdmin(userId);

    const data: Record<string, unknown> = {};

    if (dto.animeId !== undefined) data.animeId = dto.animeId;
    if (dto.externalAnimeId !== undefined) data.externalAnimeId = dto.externalAnimeId;
    if (dto.question !== undefined) data.question = dto.question.trim();

    if (dto.options !== undefined) {
      if (dto.correctAnswerIndex !== undefined) {
        const randomized = this.moveCorrectAnswerToBalancedPosition(
          dto.options,
          dto.correctAnswerIndex,
          dto.correctAnswerIndex,
        );

        data.options = randomized.options;
        data.correctAnswerIndex = randomized.correctAnswerIndex;
      } else {
        data.options = dto.options;
      }
    }

    if (dto.correctAnswerIndex !== undefined && dto.options === undefined) {
      data.correctAnswerIndex = dto.correctAnswerIndex;
    }

    if (dto.difficulty !== undefined) data.difficulty = dto.difficulty;
    if (dto.category !== undefined) data.category = dto.category.trim();
    if (dto.explanation !== undefined) data.explanation = dto.explanation.trim();

    if (dto.status !== undefined) {
      data.status = dto.status;

      if (dto.status === 'APPROVED' || dto.status === 'REJECTED') {
        data.reviewedByUserId = userId;
        data.reviewedAt = new Date();
      }
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No hay campos para actualizar');
    }

    if (dto.options && dto.correctAnswerIndex !== undefined) {
      this.validateCorrectAnswerIndex(dto.options, dto.correctAnswerIndex);
    }

    try {
      const updated = await this.prisma.triviaQuestion.update({
        where: {
          id: questionId,
        },
        data,
      });

      const [enrichedQuestion] = await this.withAnimeTitles([updated]);

      return enrichedQuestion;
    } catch {
      throw new NotFoundException('Pregunta no encontrada');
    }
  }

  async deleteQuestion(userId: string, questionId: string) {
    await this.assertAdmin(userId);

    try {
      const deleted = await this.prisma.triviaQuestion.delete({
        where: {
          id: questionId,
        },
      });

      const [enrichedQuestion] = await this.withAnimeTitles([deleted]);

      return {
        success: true,
        message: 'Pregunta eliminada correctamente',
        question: enrichedQuestion,
      };
    } catch {
      throw new NotFoundException('Pregunta no encontrada');
    }
  }

  private async withAnimeTitles<T extends { animeId: number | null }>(
    questions: T[],
  ): Promise<Array<T & { animeTitle: string | null }>> {
    const animeIds = [
      ...new Set(
        questions
          .map((question) => question.animeId)
          .filter((animeId): animeId is number => {
            return typeof animeId === 'number' && Number.isFinite(animeId);
          }),
      ),
    ];

    const titlesByAnimeId = new Map<number, string>();

    await Promise.all(
      animeIds.map(async (animeId) => {
        try {
          const result = await this.animeService.getById(animeId);
          titlesByAnimeId.set(animeId, result.data.title);
        } catch (error) {
          console.warn(
            `[TriviaAdminService] No fue posible resolver el título del anime animeId=${animeId}`,
            error,
          );
        }
      }),
    );

    return questions.map((question) => ({
      ...question,
      animeTitle:
        question.animeId != null
          ? titlesByAnimeId.get(question.animeId) ?? null
          : null,
    }));
  }

  private validateBulkItem(item: any): string | null {
    if (!item) return 'El item está vacío.';

    if (!item.animeId || !Number.isInteger(item.animeId) || item.animeId <= 0) {
      return 'animeId es obligatorio y debe ser un número válido.';
    }

    if (!item.question || typeof item.question !== 'string' || item.question.trim().length < 8) {
      return 'La pregunta es obligatoria y debe tener al menos 8 caracteres.';
    }

    if (!Array.isArray(item.options) || item.options.length !== 4) {
      return 'options debe tener exactamente 4 opciones.';
    }

    const cleanedOptions = item.options.map((option) =>
      typeof option === 'string' ? option.trim() : '',
    );

    if (cleanedOptions.some((option) => !option)) {
      return 'Todas las opciones deben tener texto.';
    }

    const uniqueOptions = new Set(
      cleanedOptions.map((option) => this.normalizeQuestion(option)),
    );

    if (uniqueOptions.size !== 4) {
      return 'Las 4 opciones deben ser diferentes.';
    }

    if (!Number.isInteger(item.correctAnswerIndex) || item.correctAnswerIndex < 0 || item.correctAnswerIndex > 3) {
      return 'correctAnswerIndex debe estar entre 0 y 3.';
    }

    if (!['EASY', 'MEDIUM', 'HARD'].includes(item.difficulty)) {
      return 'difficulty debe ser EASY, MEDIUM o HARD.';
    }

    if (item.status && !['PENDING', 'APPROVED', 'REJECTED'].includes(item.status)) {
      return 'status debe ser PENDING, APPROVED o REJECTED.';
    }

    return null;
  }

  private validateQuestionPayload(dto: UpsertTriviaQuestionDto, requireAll: boolean) {
    if (requireAll) {
      if (!dto.animeId) {
        throw new BadRequestException('animeId es obligatorio');
      }

      if (!dto.question?.trim()) {
        throw new BadRequestException('question es obligatorio');
      }

      if (!dto.options || dto.options.length !== 4) {
        throw new BadRequestException('options debe tener exactamente 4 opciones');
      }

      if (dto.correctAnswerIndex === undefined) {
        throw new BadRequestException('correctAnswerIndex es obligatorio');
      }

      if (!dto.difficulty) {
        throw new BadRequestException('difficulty es obligatorio');
      }
    }

    if (dto.options && dto.correctAnswerIndex !== undefined) {
      this.validateCorrectAnswerIndex(dto.options, dto.correctAnswerIndex);
    }
  }

  private validateCorrectAnswerIndex(options: string[], correctAnswerIndex: number) {
    if (!Array.isArray(options) || options.length !== 4) {
      throw new BadRequestException('La pregunta debe tener exactamente 4 opciones');
    }

    if (correctAnswerIndex < 0 || correctAnswerIndex > 3) {
      throw new BadRequestException('correctAnswerIndex debe estar entre 0 y 3');
    }

    const normalized = options.map((option) => option.trim()).filter(Boolean);

    if (normalized.length !== 4) {
      throw new BadRequestException('Todas las opciones deben tener texto');
    }

    const uniqueOptions = new Set(
      normalized.map((option) => this.normalizeQuestion(option)),
    );

    if (uniqueOptions.size !== 4) {
      throw new BadRequestException('Las 4 opciones deben ser diferentes');
    }
  }

  private moveCorrectAnswerToBalancedPosition(
    options: string[],
    correctAnswerIndex: number,
    targetCorrectAnswerIndex: number,
  ) {
    this.validateCorrectAnswerIndex(options, correctAnswerIndex);

    const cleanedOptions = options.map((option) => option.trim());
    const correctAnswer = cleanedOptions[correctAnswerIndex];
    const wrongOptions = cleanedOptions.filter((_, index) => index !== correctAnswerIndex);

    const safeTargetIndex = Math.max(0, Math.min(3, targetCorrectAnswerIndex));
    const result: string[] = [];
    let wrongCursor = 0;

    for (let index = 0; index < 4; index += 1) {
      if (index === safeTargetIndex) {
        result.push(correctAnswer);
      } else {
        result.push(wrongOptions[wrongCursor]);
        wrongCursor += 1;
      }
    }

    return {
      options: result,
      correctAnswerIndex: safeTargetIndex,
    };
  }

  private normalizeQuestion(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[¿?¡!.,;:()[\]{}'"`´]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private randomIndexFromText(value: string): number {
    const normalized = this.normalizeQuestion(value);
    let hash = 0;

    for (let index = 0; index < normalized.length; index += 1) {
      hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0;
    }

    return hash % 4;
  }

  private async assertAdmin(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new ForbiddenException('Usuario no encontrado');
    }

    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Solo un administrador puede realizar esta acción');
    }

    return user;
  }
}