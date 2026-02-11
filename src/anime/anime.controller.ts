import { Controller, Get, Param, ParseIntPipe, Query, Req } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AnimeService } from './anime.service';
import { AnimeSearchQueryDto, AnimeTopQueryDto } from './dto/anime-query.dto';

@ApiTags('anime')
@Controller('anime')
export class AnimeController {
  constructor(private readonly animeService: AnimeService) {}

  @Get('top')
  @ApiOperation({ summary: 'Get top anime list' })
  @ApiOkResponse({ description: 'Returns top anime with meta wrapper.' })
  getTop(@Query() query: AnimeTopQueryDto, @Req() req: Request) {
    return this.animeService.getTop(query.limit ?? 10, req.requestId, query.includeAdult);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search anime by query' })
  @ApiOkResponse({ description: 'Returns search results with meta wrapper.' })
  search(@Query() query: AnimeSearchQueryDto, @Req() req: Request) {
    return this.animeService.search(query.q, query.limit ?? 10, req.requestId, query.includeAdult);
  }

  @Get('hero')
  @ApiOperation({ summary: 'Get hero recommendation anime' })
  @ApiOkResponse({ description: 'Returns a single hero anime.' })
  getHero(@Req() req: Request) {
    return this.animeService.getHero(req.requestId);
  }

  @Get('by-genre/:genreId')
  getByGenre(
    @Param('genreId', ParseIntPipe) genreId: number,
    @Query() query: AnimeTopQueryDto,
    @Req() req: Request,
  ) {
    return this.animeService.getByGenre(
      String(genreId),
      query.limit ?? 10,
      req.requestId,
      query.includeAdult,
    );
  }

  @Get(':id/detail')
  @ApiOperation({ summary: 'Get anime detail with cultural notes and trailers' })
  @ApiOkResponse({ description: 'Returns anime detail.' })
  getDetail(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.animeService.getDetail(id, req.requestId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get anime by id' })
  @ApiOkResponse({ description: 'Returns a single anime.' })
  getById(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.animeService.getById(id, req.requestId);
  }
}
