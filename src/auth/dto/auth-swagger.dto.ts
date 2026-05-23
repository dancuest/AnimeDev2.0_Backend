import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuthProfileResponseDto {
  @ApiProperty({ example: '6e371561-2132-4040-9809-efe4f5b39e02' })
  id!: string;

  @ApiPropertyOptional({ example: 'usuario@correo.com', nullable: true })
  email?: string | null;

  @ApiPropertyOptional({ example: 'Dan Cuestas', nullable: true })
  displayName?: string | null;

  @ApiPropertyOptional({ example: 'device-android-12345678', nullable: true })
  deviceId?: string | null;

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
}

export class AuthSessionResponseDto {
  @ApiProperty({ example: '6e371561-2132-4040-9809-efe4f5b39e02' })
  userId!: string;

  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT access token',
  })
  access_token!: string;

  @ApiPropertyOptional({
    example: 'device',
    nullable: true,
    description: 'Authentication mode resolved by backend',
  })
  authMode?: string | null;

  @ApiPropertyOptional({ type: AuthProfileResponseDto, nullable: true })
  profile?: AuthProfileResponseDto | null;
}

export class ForgotPasswordResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'Token de recuperación generado' })
  message!: string;

  @ApiPropertyOptional({
    example: 'ABC12345',
    nullable: true,
    description:
      'Reset token returned by the backend in demo mode instead of email delivery',
  })
  resetToken?: string | null;

  @ApiPropertyOptional({
    example: '2026-04-07T18:25:00.000Z',
    nullable: true,
  })
  expiresAt?: string | null;

  @ApiPropertyOptional({
    example:
      'Modo demo: este token se devuelve en la respuesta en lugar de enviarse por correo',
    nullable: true,
  })
  note?: string | null;
}

export class BasicMessageResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'Operación completada correctamente.' })
  message!: string;
}

export class AuthMeResponseDto {
  @ApiProperty({ example: '6e371561-2132-4040-9809-efe4f5b39e02' })
  id!: string;

  @ApiPropertyOptional({ example: 'device-android-12345678', nullable: true })
  deviceId?: string | null;

  @ApiPropertyOptional({ example: 'usuario@correo.com', nullable: true })
  email?: string | null;

  @ApiPropertyOptional({ example: 'Dan Cuestas', nullable: true })
  displayName?: string | null;

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

  @ApiPropertyOptional({
    example: 'email',
    nullable: true,
    description: 'Authentication mode resolved by backend',
  })
  authMode?: string | null;
}