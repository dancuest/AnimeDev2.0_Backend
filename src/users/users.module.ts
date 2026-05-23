import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AnimeModule } from '../anime/anime.module';
import { InteractionsModule } from '../interactions/interactions.module';

@Module({
  imports: [PrismaModule, AnimeModule, InteractionsModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}