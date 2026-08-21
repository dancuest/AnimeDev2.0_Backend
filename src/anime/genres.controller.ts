import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AnimeService } from './anime.service';
import { GenresQueryDto } from './dto/anime-query.dto';
import { AnimeGenreCatalogResponseDto } from './dto/anime-swagger.dto';
// Este archivo pertenece al módulo de anime y se encarga de manejar la información de los animes, ya sea para listarlos, filtrarlos o enriquecerlos.


@ApiTags('géneros')
@Controller('genres')
export class GenresController {
  constructor(private readonly animeService: AnimeService) { }

  @Get()
  @ApiOperation({ summary: 'Obtener el catálogo de géneros de anime' })
  @ApiOkResponse({
    type: AnimeGenreCatalogResponseDto,
    description: 'Retorna la lista de géneros de anime.',
  })
  getGenres(@Query() query: GenresQueryDto, @Req() req: Request) {
    return this.animeService.getGenres(query.includeAdult ?? true, req.requestId);
  }
}