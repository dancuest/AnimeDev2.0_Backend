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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateInteractionDto } from './dto/create-interaction.dto';
import { InteractionsService } from './interactions.service';

@Controller('interactions')
@UseGuards(JwtAuthGuard)
export class InteractionsController {
  constructor(private readonly interactionsService: InteractionsService) {}

  @Post()
  create(
    @Req() req: Request & { user?: { userId: string } },
    @Body() dto: CreateInteractionDto,
  ) {
    return this.interactionsService.create(req.user!.userId, dto);
  }

  @Get('me')
  listMine(
    @Req() req: Request & { user?: { userId: string } },
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.interactionsService.listMine(req.user!.userId, limit);
  }
}
