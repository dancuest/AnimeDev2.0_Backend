import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    example: 'ClaveActual123',
    description: 'Current password',
    minLength: 1,
  })
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @ApiProperty({
    example: 'ClaveNueva123',
    description: 'New password',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  newPassword!: string;
}