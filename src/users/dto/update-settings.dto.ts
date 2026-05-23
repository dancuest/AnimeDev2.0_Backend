import { IsArray, IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  ageRange?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  genderCode?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  regionCode?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  preferredGenres?: number[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredDurations?: string[];

  @IsOptional()
  @IsObject()
  toggles?: Record<string, any>;
}