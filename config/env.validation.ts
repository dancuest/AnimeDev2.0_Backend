import { plainToInstance } from 'class-transformer';
import {
// Este archivo forma parte de la estructura del proyecto y ayuda a organizar una funcionalidad concreta del backend.

  IsBooleanString,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  MinLength,
} from 'class-validator';
import { validateSync } from 'class-validator';

class EnvironmentVariables {
  @IsOptional()
  @IsInt()
  @Min(1)
  PORT?: number;

  @IsOptional()
  @IsString()
  @IsUrl()
  JIKAN_BASE_URL?: string;

  @IsOptional()
  @IsString()
  @IsUrl()
  ANILIST_BASE_URL?: string;

  @IsOptional()
  @IsString()
  @IsUrl()
  KITSU_BASE_URL?: string;

  @IsOptional()
  @IsString()
  ANIME_PROVIDER_ORDER?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  CACHE_TTL_SECONDS?: number;

  @IsOptional()
  @IsInt()
  @Min(30)
  SHORT_CACHE_TTL_SECONDS?: number;

  @IsOptional()
  @IsBooleanString()
  TRANSLATE_SYNOPSES?: string;

  @IsOptional()
  @IsString()
  @IsUrl()
  TRANSLATION_BASE_URL?: string;

  @IsOptional()
  @IsEmail()
  TRANSLATION_EMAIL?: string;

  @IsOptional()
  @IsString()
  @MinLength(32)
  JWT_SECRET?: string;

  @IsOptional()
  @IsString()
  JWT_EXPIRES_IN?: string;
}

export function validateEnvironment(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: true,
  });

  if (errors.length > 0) {
    throw new Error(
      `Environment validation error: ${errors.toString()}`,
    );
  }

  return validatedConfig;
}
