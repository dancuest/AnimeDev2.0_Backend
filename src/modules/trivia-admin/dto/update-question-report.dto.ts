import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
// Este archivo define la estructura de los datos que recibe o devuelve la API, lo que ayuda a mantener los contratos más claros entre capas.


export class UpdateQuestionReportDto {
    @IsOptional()
    @IsIn(['PENDING', 'RESOLVED', 'REJECTED', 'DELETED'])
    status?: 'PENDING' | 'RESOLVED' | 'REJECTED' | 'DELETED';

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    adminNote?: string;
} 