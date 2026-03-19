import { IsString, MinLength } from 'class-validator';

export class DeviceLoginDto {
  @IsString()
  @MinLength(8)
  deviceId: string;
}