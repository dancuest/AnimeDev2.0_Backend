import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'usuario@correo.com',
    description: 'Email address that will receive or generate the reset token',
  })
  @IsEmail()
  email!: string;
}