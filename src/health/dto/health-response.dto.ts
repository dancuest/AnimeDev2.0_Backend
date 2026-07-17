import { ApiProperty } from '@nestjs/swagger';
// Este archivo define la estructura de los datos que recibe o devuelve la API, lo que ayuda a mantener los contratos más claros entre capas.


export class HealthResponseDto {
  @ApiProperty({ example: 'ok' })
  status!: string;

  @ApiProperty({ example: 'animedev-backend' })
  service!: string;
}