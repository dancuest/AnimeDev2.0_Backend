import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class PreferredGenreDetailResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Action' })
  name!: string;
}

export class UserMeResponseDto {
  @ApiProperty({ example: '6e371561-2132-4040-9809-efe4f5b39e02' })
  id!: string;

  @ApiPropertyOptional({
    example: 'device-android-12345678',
    nullable: true,
  })
  deviceId?: string | null;

  @ApiPropertyOptional({
    example: 'usuario@correo.com',
    nullable: true,
  })
  email?: string | null;

  @ApiPropertyOptional({
    example: 'Dan Cuestas',
    nullable: true,
  })
  displayName?: string | null;

  @ApiPropertyOptional({
    example: 'Antigravity',
    nullable: true,
  })
  nickname?: string | null;

  @ApiPropertyOptional({
    example: 'https://cdn.midominio.com/avatar.png',
    nullable: true,
  })
  avatarUrl?: string | null;

  @ApiPropertyOptional({
    example: 'https://cdn.midominio.com/cover.png',
    nullable: true,
  })
  coverImageUrl?: string | null;

  @ApiPropertyOptional({
    example: '2026-04-07T18:25:00.000Z',
    nullable: true,
  })
  createdAt?: string | null;

  @ApiProperty({
    enum: UserRole,
    example: UserRole.USER,
    description: 'Rol del usuario dentro de AnimeDev.',
  })
  role!: UserRole;

  @ApiPropertyOptional({
    example: 8,
    nullable: true,
  })
  completedTrivias?: number | null;

  @ApiPropertyOptional({
    example: 15,
    nullable: true,
  })
  favoriteCount?: number | null;
}

export class UserSettingsResponseDto {
  @ApiProperty({ example: '6e371561-2132-4040-9809-efe4f5b39e02' })
  userId!: string;

  @ApiPropertyOptional({
    example: 3,
    nullable: true,
  })
  ageRange?: number | null;

  @ApiPropertyOptional({
    example: 1,
    nullable: true,
  })
  genderCode?: number | null;

  @ApiPropertyOptional({
    example: 2,
    nullable: true,
  })
  regionCode?: number | null;

  @ApiProperty({
    type: [Number],
    example: [1, 22, 30],
  })
  preferredGenres!: number[];

  @ApiPropertyOptional({
    type: [PreferredGenreDetailResponseDto],
  })
  preferredGenreDetails?: PreferredGenreDetailResponseDto[];

  @ApiProperty({
    type: [String],
    example: ['SHORT', 'MEDIUM'],
  })
  preferredDurations!: string[];

  @ApiPropertyOptional({
    type: Object,
    example: {
      notificationsEnabled: true,
      autoplayTrailers: false,
    },
  })
  toggles?: Record<string, unknown>;

  @ApiPropertyOptional({
    example: '2026-04-07T18:25:00.000Z',
    nullable: true,
  })
  createdAt?: string | null;

  @ApiPropertyOptional({
    example: '2026-04-07T18:30:00.000Z',
    nullable: true,
  })
  updatedAt?: string | null;
}

export class FavoriteIdsResponseDto {
  @ApiProperty({
    type: [Number],
    example: [5114, 9253, 16498],
  })
  data!: number[];

  @ApiProperty({ example: 3 })
  count!: number;
}

export class ChangePasswordResponseDto {
  @ApiProperty({
    example: 'Contraseña actualizada correctamente.',
  })
  message!: string;
}