import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

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