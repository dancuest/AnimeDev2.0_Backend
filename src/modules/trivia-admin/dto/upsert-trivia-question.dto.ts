import {
    ArrayMaxSize,
    ArrayMinSize,
    IsArray,
    IsIn,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    MaxLength,
    Min,
} from 'class-validator';

export class UpsertTriviaQuestionDto {
    @IsOptional()
    @IsInt()
    @Min(1)
    animeId?: number;

    @IsOptional()
    @IsString()
    @MaxLength(80)
    externalAnimeId?: string;

    @IsOptional()
    @IsString()
    @IsNotEmpty()
    @MaxLength(700)
    question?: string;

    @IsOptional()
    @IsArray()
    @ArrayMinSize(4)
    @ArrayMaxSize(4)
    @IsString({ each: true })
    options?: string[];

    @IsOptional()
    @IsInt()
    @Min(0)
    correctAnswerIndex?: number;

    @IsOptional()
    @IsIn(['EASY', 'MEDIUM', 'HARD'])
    difficulty?: 'EASY' | 'MEDIUM' | 'HARD';

    @IsOptional()
    @IsString()
    @MaxLength(80)
    category?: string;

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    explanation?: string;

    @IsOptional()
    @IsIn(['PENDING', 'APPROVED', 'REJECTED'])
    status?: 'PENDING' | 'APPROVED' | 'REJECTED';
}