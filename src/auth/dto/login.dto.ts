import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';
// Aquí va la lógica de autenticación del proyecto: login, registro, recuperación de cuenta y validación de sesiones.


export class LoginDto {
  @ApiProperty({
    example: 'usuario@correo.com',
    description: 'User email address',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'MiClave123',
    minLength: 6,
    description: 'User password',
  })
  @IsString()
  @MinLength(6)
  password!: string;
}