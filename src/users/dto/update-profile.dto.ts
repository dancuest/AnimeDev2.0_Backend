import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const normalizeOptionalString = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export class UpdateProfileDto {
  @ApiPropertyOptional({
    example: 'Dan Cuestas',
    minLength: 2,
    description: 'Display name shown in the user profile',
  })
  @IsOptional()
  @Transform(normalizeOptionalString)
  @IsString()
  @MinLength(2)
  displayName?: string;

  @ApiPropertyOptional({
    example: 'Antigravity',
    minLength: 2,
    description: 'Optional nickname shown in the profile',
  })
  @IsOptional()
  @Transform(normalizeOptionalString)
  @IsString()
  @MinLength(2)
  nickname?: string;

  @ApiPropertyOptional({
    example: 'usuario@correo.com',
    description: 'User email address',
  })
  @IsOptional()
  @Transform(normalizeOptionalString)
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.midominio.com/avatar.png',
    description: 'Avatar image URL',
  })
  @IsOptional()
  @Transform(normalizeOptionalString)
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.midominio.com/cover.png',
    description: 'Cover image URL',
  })
  @IsOptional()
  @Transform(normalizeOptionalString)
  @IsString()
  coverImageUrl?: string;
}