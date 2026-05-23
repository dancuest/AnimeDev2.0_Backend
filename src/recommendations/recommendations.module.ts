import { Module } from '@nestjs/common';
<<<<<<< HEAD
import { RecommendationsService } from './recommendations.service';
import { RecommendationsController } from './recommendations.controller';
import { AnimeModule } from '../anime/anime.module';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
    imports: [PrismaModule, AnimeModule],
    controllers: [RecommendationsController],
    providers: [RecommendationsService],
    exports: [RecommendationsService],
})
export class RecommendationsModule { }
=======

@Module({})
export class RecommendationsModule {}
>>>>>>> 906a70d (Configurar base tecnica del backend)
