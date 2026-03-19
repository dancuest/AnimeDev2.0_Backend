import { Controller, Get, Req, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { RecommendationsService } from './recommendations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('recommendations')
@Controller('recommendations')
export class RecommendationsController {
    constructor(private readonly recommendationsService: RecommendationsService) { }

    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @Get('adaptive')
    @ApiOperation({ summary: 'Get adaptive recommendations using Cosine Similarity based on User Interactions' })
    @ApiOkResponse({ description: 'Returns personalized list of anime.' })
    async getAdaptiveRecommendations(@Req() req: Request & { user?: { userId: string } }) {
        const userId = req.user?.userId;
        if (!userId) {
            throw new HttpException('User not found in request', HttpStatus.UNAUTHORIZED);
        }

        // As in other controllers, getting requestId if available
        const requestId = (req as any).requestId;

        const recommendations = await this.recommendationsService.getAdaptiveRecommendations(userId, requestId);

        return recommendations;
    }
}
