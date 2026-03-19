import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

const normalizeOptionalString = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export class UpdateProfileDto {
  @IsOptional()
  @Transform(normalizeOptionalString)
  @IsString()
  @MinLength(2)
  displayName?: string;

  @IsOptional()
  @Transform(normalizeOptionalString)
  @IsEmail()
  email?: string;

  @IsOptional()
  @Transform(normalizeOptionalString)
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @Transform(normalizeOptionalString)
  @IsString()
  coverImageUrl?: string;
}