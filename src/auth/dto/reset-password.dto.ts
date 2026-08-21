import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';
// Aquí va la lógica de autenticación del proyecto: login, registro, recuperación de cuenta y validación de sesiones.


export class ResetPasswordDto {
  @ApiProperty({
    example: 'usuario@correo.com',
    description: 'Email address associated with the reset token',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'ABC12345',
    minLength: 6,
    description: 'Password reset token generated previously',
  })
  @IsString()
  @MinLength(6)
  token!: string;

  @ApiProperty({
    example: 'NuevaClave123',
    minLength: 6,
    description: 'New password',
  })
  @IsString()
  @MinLength(6)
  newPassword!: string;
}