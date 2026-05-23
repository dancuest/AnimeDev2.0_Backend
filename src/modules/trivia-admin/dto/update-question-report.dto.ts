import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateQuestionReportDto {
    @IsOptional()
    @IsIn(['PENDING', 'RESOLVED', 'REJECTED', 'DELETED'])
    status?: 'PENDING' | 'RESOLVED' | 'REJECTED' | 'DELETED';

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    adminNote?: string;
} 