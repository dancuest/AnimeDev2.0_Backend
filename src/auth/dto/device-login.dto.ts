import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
// Aquí va la lógica de autenticación del proyecto: login, registro, recuperación de cuenta y validación de sesiones.


export class DeviceLoginDto {
  @ApiProperty({
    example: 'device-android-12345678',
    minLength: 8,
    description: 'Unique device identifier used for guest/device login',
  })
  @IsString()
  @MinLength(8)
  deviceId!: string;
}