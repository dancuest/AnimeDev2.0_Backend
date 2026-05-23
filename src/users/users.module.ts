import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AnimeModule } from '../anime/anime.module';

@Module({
  imports: [PrismaModule, AnimeModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
