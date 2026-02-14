import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AnimeTopQueryDto {
  @ApiPropertyOptional({ example: 10, minimum: 1, maximum: 50 })
  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({
    example: false,
    default: false,
    description: 'Whether to include adult content in anime lists (if false, uses sfw filter upstream)',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === '') return undefined;
    if (typeof value === 'boolean') return value;
    return String(value).toLowerCase() === 'true';
  })
  @IsBoolean()
  includeAdult?: boolean;
}

export class AnimeSearchQueryDto {
  @ApiProperty({ example: 'naruto', description: 'Search term' })
  @IsString()
  @IsNotEmpty()
  q!: string;

  @ApiPropertyOptional({ example: 3, minimum: 1, maximum: 50 })
  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({
    example: false,
    default: false,
    description: 'Whether to include adult content in search results (if false, uses sfw filter upstream)',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === '') return undefined;
    if (typeof value === 'boolean') return value;
    return String(value).toLowerCase() === 'true';
  })
  @IsBoolean()
  includeAdult?: boolean;
}

export class GenresQueryDto {
  @ApiPropertyOptional({
    example: false,
    default: true,
    description: 'Whether to include adult genres (Ecchi, Hentai, Erotica)',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === '') return undefined;
    if (typeof value === 'boolean') return value;
    return String(value).toLowerCase() !== 'false';
  })
  @IsBoolean()
  includeAdult?: boolean;
}
