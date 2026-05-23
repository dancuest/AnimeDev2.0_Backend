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
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BulkImportTriviaQuestionItemDto {
    @IsOptional()
    @IsInt()
    @Min(1)
    animeId?: number;

    @IsOptional()
    @IsString()
    @MaxLength(80)
    externalAnimeId?: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(700)
    question!: string;

    @IsArray()
    @ArrayMinSize(4)
    @ArrayMaxSize(4)
    @IsString({ each: true })
    options!: string[];

    @IsInt()
    @Min(0)
    correctAnswerIndex!: number;

    @IsIn(['EASY', 'MEDIUM', 'HARD'])
    difficulty!: 'EASY' | 'MEDIUM' | 'HARD';

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

export class BulkImportTriviaQuestionsDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => BulkImportTriviaQuestionItemDto)
    questions!: BulkImportTriviaQuestionItemDto[];
}