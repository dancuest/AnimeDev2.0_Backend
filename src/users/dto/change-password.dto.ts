import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
// Aquí se concentran las operaciones relacionadas con usuarios, perfiles y preferencias, que luego alimentan el resto del sistema.


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