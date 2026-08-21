import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
// Aquí va la lógica de autenticación del proyecto: login, registro, recuperación de cuenta y validación de sesiones.


export class RegisterDto {
  @ApiProperty({
    example: 'usuario@correo.com',
    description: 'Email to associate with the current device account',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'MiClave123',
    minLength: 6,
    description: 'Password for the new credentials',
  })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiPropertyOptional({
    example: 'Dan Cuestas',
    minLength: 2,
    description: 'Optional display name',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  displayName?: string;
}