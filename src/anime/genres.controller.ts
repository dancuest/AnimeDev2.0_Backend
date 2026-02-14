import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AnimeService } from './anime.service';
import { GenresQueryDto } from './dto/anime-query.dto';

@ApiTags('genres')
@Controller('genres')
export class GenresController {
  constructor(private readonly animeService: AnimeService) {}

  @Get()
  @ApiOperation({ summary: 'Get anime genres' })
  @ApiOkResponse({ description: 'Returns list of anime genres.' })
  getGenres(@Query() query: GenresQueryDto, @Req() req: Request) {
    return this.animeService.getGenres(query.includeAdult ?? true, req.requestId);
  }
}
