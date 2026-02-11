import { Controller, Get, Param, ParseIntPipe, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AnimeService } from './anime.service';
import { AnimeSearchQueryDto, AnimeTopQueryDto } from './dto/anime-query.dto';

@ApiTags('anime')
@Controller('anime')
export class AnimeController {
  constructor(private readonly animeService: AnimeService) {}

  @Get('top')
  getTop(@Query() query: AnimeTopQueryDto, @Req() req: Request) {
    return this.animeService.getTop(query.limit ?? 10, req.requestId);
  }

  @Get('search')
  search(@Query() query: AnimeSearchQueryDto, @Req() req: Request) {
    return this.animeService.search(query.q, query.limit ?? 10, req.requestId);
  }

  @Get(':id')
  getById(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.animeService.getById(id, req.requestId);
  }
}
