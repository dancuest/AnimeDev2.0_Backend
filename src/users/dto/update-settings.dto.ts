import {
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSettingsDto {
  @ApiPropertyOptional({
    example: 3,
    description: 'Age range code used by the recommendation engine',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  ageRange?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Gender code used by the recommendation engine',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  genderCode?: number;

  @ApiPropertyOptional({
    example: 2,
    description: 'Region code used by the recommendation engine',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  regionCode?: number;

  @ApiPropertyOptional({
    example: [1, 22, 30],
    description: 'Preferred anime genre ids',
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  preferredGenres?: number[];

  @ApiPropertyOptional({
    example: ['SHORT', 'MEDIUM'],
    description: 'Preferred duration buckets',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredDurations?: string[];

  @ApiPropertyOptional({
    type: Object,
    example: {
      notificationsEnabled: true,
      showAdultContent: false,
      autoplayTrailers: true,
    },
    description: 'Additional feature toggles',
  })
  @IsOptional()
  @IsObject()
  toggles?: Record<string, unknown>;
}