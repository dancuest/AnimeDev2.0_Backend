import {
    Body,
    Controller,
    DefaultValuePipe,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Query,
    Req,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { BulkImportTriviaQuestionsDto } from './dto/bulk-import-trivia-question.dto';
import { CreateQuestionReportDto } from './dto/create-question-report.dto';
import { TriviaAdminService } from './trivia-admin.service';
import { UpdateQuestionReportDto } from './dto/update-question-report.dto';
import { UpsertTriviaQuestionDto } from './dto/upsert-trivia-question.dto';

type AuthenticatedRequest = Request & {
    user?: {
        userId?: string;
        id?: string;
    };
};

@ApiTags('Trivia')
@ApiBearerAuth('access-token')
@Controller('trivia')
export class TriviaAdminController {
    constructor(private readonly triviaAdminService: TriviaAdminService) { }

    @UseGuards(JwtAuthGuard)
    @Post('question-reports')
    createQuestionReport(
        @Req() req: AuthenticatedRequest,
        @Body() dto: CreateQuestionReportDto,
    ) {
        return this.triviaAdminService.createQuestionReport(
            this.getUserId(req),
            dto,
        );
    }

    @UseGuards(JwtAuthGuard)
    @Post('bulk-import')
    bulkImportQuestions(
        @Req() req: AuthenticatedRequest,
        @Body() dto: BulkImportTriviaQuestionsDto,
    ) {
        return this.triviaAdminService.bulkImportQuestions(
            this.getUserId(req),
            dto,
        );
    }

    @UseGuards(JwtAuthGuard)
    @Get('admin/question-reports')
    listQuestionReports(
        @Req() req: AuthenticatedRequest,
        @Query('status', new DefaultValuePipe('PENDING')) status: string,
    ) {
        return this.triviaAdminService.listQuestionReports(
            this.getUserId(req),
            status,
        );
    }

    @UseGuards(JwtAuthGuard)
    @Patch('admin/question-reports/:id')
    updateQuestionReport(
        @Req() req: AuthenticatedRequest,
        @Param('id') id: string,
        @Body() dto: UpdateQuestionReportDto,
    ) {
        return this.triviaAdminService.updateQuestionReport(
            this.getUserId(req),
            id,
            dto,
        );
    }

    @UseGuards(JwtAuthGuard)
    @Get('admin/questions')
    listQuestionsForAdmin(
        @Req() req: AuthenticatedRequest,
        @Query('status', new DefaultValuePipe('PENDING')) status: string,
    ) {
        return this.triviaAdminService.listQuestionsForAdmin(
            this.getUserId(req),
            status,
        );
    }

    @UseGuards(JwtAuthGuard)
    @Get('admin/questions/:id')
    getQuestionById(
        @Req() req: AuthenticatedRequest,
        @Param('id') id: string,
    ) {
        return this.triviaAdminService.getQuestionById(
            this.getUserId(req),
            id,
        );
    }

    @UseGuards(JwtAuthGuard)
    @Get('admin/anime-search')
    searchAnime(
        @Req() req: AuthenticatedRequest,
        @Query('q', new DefaultValuePipe('')) q: string,
    ) {
        return this.triviaAdminService.searchAnime(this.getUserId(req), q);
    }

    @UseGuards(JwtAuthGuard)
    @Get('admin/anime/:animeId/questions')
    listQuestionsByAnime(
        @Req() req: AuthenticatedRequest,
        @Param('animeId', ParseIntPipe) animeId: number,
    ) {
        return this.triviaAdminService.listQuestionsByAnime(
            this.getUserId(req),
            animeId,
        );
    }

    @UseGuards(JwtAuthGuard)
    @Post('admin/questions')
    createQuestionAsAdmin(
        @Req() req: AuthenticatedRequest,
        @Body() dto: UpsertTriviaQuestionDto,
    ) {
        return this.triviaAdminService.createQuestionAsAdmin(
            this.getUserId(req),
            dto,
        );
    }

    @UseGuards(JwtAuthGuard)
    @Patch('admin/questions/:id')
    updateQuestion(
        @Req() req: AuthenticatedRequest,
        @Param('id') id: string,
        @Body() dto: UpsertTriviaQuestionDto,
    ) {
        return this.triviaAdminService.updateQuestion(
            this.getUserId(req),
            id,
            dto,
        );
    }

    @UseGuards(JwtAuthGuard)
    @Delete('admin/questions/:id')
    deleteQuestion(
        @Req() req: AuthenticatedRequest,
        @Param('id') id: string,
    ) {
        return this.triviaAdminService.deleteQuestion(
            this.getUserId(req),
            id,
        );
    }

    private getUserId(req: AuthenticatedRequest): string {
        const userId = req.user?.userId ?? req.user?.id;

        if (!userId) {
            throw new Error('Usuario no autenticado');
        }

        return userId;
    }
}