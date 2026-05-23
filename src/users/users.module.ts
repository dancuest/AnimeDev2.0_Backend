import { Module } from '@nestjs/common';
<<<<<<< HEAD
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AnimeModule } from '../anime/anime.module';

@Module({
  imports: [PrismaModule, AnimeModule],
  controllers: [UsersController],
  providers: [UsersService],
})
=======

@Module({})
>>>>>>> 906a70d (Configurar base tecnica del backend)
export class UsersModule {}
