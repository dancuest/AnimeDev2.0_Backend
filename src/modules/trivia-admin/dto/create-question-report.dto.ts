import {
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    MaxLength,
    Min,
    MinLength,
} from 'class-validator';

export class CreateQuestionReportDto {
    @IsString()
    @IsNotEmpty()
    questionId!: string;

    @IsOptional()
    @IsInt()
    @Min(1)
    animeId?: number;

    @IsOptional()
    @IsString()
    @MaxLength(180)
    animeTitle?: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(600)
    questionText!: string;

    @IsString()
    @MinLength(8)
    @MaxLength(1000)
    reason!: string;
}