import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';
// Aquí va la lógica de autenticación del proyecto: login, registro, recuperación de cuenta y validación de sesiones.


export class ForgotPasswordDto {
  @ApiProperty({
    example: 'usuario@correo.com',
    description: 'Email address that will receive or generate the reset token',
  })
  @IsEmail()
  email!: string;
}