import { Module } from '@nestjs/common';
import { AnimeModule } from '../../anime/anime.module';
import { TriviaAdminController } from './trivia-admin.controller';
import { TriviaAdminService } from './trivia-admin.service';

@Module({
    imports: [AnimeModule],
    controllers: [TriviaAdminController],
    providers: [TriviaAdminService],
    exports: [TriviaAdminService],
})
export class TriviaAdminModule { }