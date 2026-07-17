import { Controller, Get, Param, ParseIntPipe, Query, Req } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';

import { AnimeService } from './anime.service';
import { AnimeSearchQueryDto, AnimeTopQueryDto } from './dto/anime-query.dto';
import {
  AnimeDetailResponseDto,
  AnimeListResponseDto,
  AnimeSearchResponseDto,
  AnimeSingleResponseDto,
} from './dto/anime-swagger.dto';

@ApiTags('anime')
@Controller('anime')
export class AnimeController {
  constructor(private readonly animeService: AnimeService) { }

  @Get('top')
  @ApiOperation({
    summary: 'Obtener la lista de animes destacados',
  })
  @ApiOkResponse({
    type: AnimeListResponseDto,
    description:
      'Retorna la lista de animes destacados con su metainformación.',
  })
  getTop(@Query() query: AnimeTopQueryDto, @Req() req: Request) {
    return this.animeService.getTop(
      query.limit ?? 10,
      req.requestId,
      query.includeAdult,
    );
  }

  @Get('search')
  @ApiOperation({
    summary: 'Buscar anime por texto',
  })
  @ApiOkResponse({
    type: AnimeSearchResponseDto,
    description:
      'Retorna los resultados de búsqueda de anime con metadatos de paginación.',
  })
  search(@Query() query: AnimeSearchQueryDto, @Req() req: Request) {
    return this.animeService.search(
      query.q,
      query.limit ?? 10,
      req.requestId,
      query.includeAdult,
    );
  }

  @Get('hero')
  @ApiOperation({
    summary: 'Obtener el anime principal de la pantalla de inicio',
  })
  @ApiOkResponse({
    type: AnimeSingleResponseDto,
    description: 'Retorna un único anime principal.',
  })
  getHero(@Req() req: Request) {
    return this.animeService.getHero(req.requestId);
  }

  @Get('by-genre/:genreId')
  @ApiOperation({
    summary: 'Obtener la lista de animes filtrada por identificador de género',
  })
  @ApiParam({
    name: 'genreId',
    example: 1,
    description: 'Identificador del género del anime',
  })
  @ApiOkResponse({
    type: AnimeListResponseDto,
    description:
      'Retorna la lista de animes filtrada por género con metadatos del límite.',
  })
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
  @ApiOperation({
    summary:
      'Obtener el detalle del anime con fichas culturales y recursos complementarios',
  })
  @ApiParam({
    name: 'id',
    example: 5114,
    description: 'Identificador del anime',
  })
  @ApiOkResponse({
    type: AnimeDetailResponseDto,
    description:
      'Retorna la información detallada del anime, incluyendo sinopsis, notas culturales y recursos externos disponibles.',
  })
  getDetail(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.animeService.getDetail(id, req.requestId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener anime por identificador',
  })
  @ApiParam({
    name: 'id',
    example: 5114,
    description: 'Identificador del anime',
  })
  @ApiOkResponse({
    type: AnimeSingleResponseDto,
    description: 'Retorna un único anime.',
  })
  getById(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.animeService.getById(id, req.requestId);
  }
}