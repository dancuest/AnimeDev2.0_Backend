import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

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