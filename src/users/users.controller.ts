import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UsersService } from './users.service';
import {
  ChangePasswordResponseDto,
  FavoriteIdsResponseDto,
  UserMeResponseDto,
  UserSettingsResponseDto,
} from './dto/users-swagger.dto';

@ApiTags('usuarios')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) { }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  @ApiOperation({ summary: 'Obtener el perfil y las estadísticas del usuario actual' })
  @ApiOkResponse({
    type: UserMeResponseDto,
    description:
      'Retorna los datos del perfil junto con las estadísticas de trivias y favoritos.',
  })
  @ApiUnauthorizedResponse({
    description: 'El token Bearer es inexistente o inválido.',
  })
  me(@Req() req: any) {
    return this.users.getMe(req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('me/profile')
  @ApiOperation({ summary: 'Actualizar el perfil del usuario actual' })
  @ApiOkResponse({
    type: UserMeResponseDto,
    description:
      'Retorna los datos actualizados del perfil junto con las estadísticas de trivias y favoritos.',
  })
  @ApiBadRequestResponse({ description: 'La validación de los datos falló.' })
  @ApiUnauthorizedResponse({
    description: 'El token Bearer es inexistente o inválido.',
  })
  updateProfile(@Req() req: any, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(req.user.userId, dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me/settings')
  @ApiOperation({ summary: 'Obtener la configuración de recomendaciones del usuario actual' })
  @ApiOkResponse({
    type: UserSettingsResponseDto,
    description:
      'Retorna la configuración actual demográfica y de preferencias.',
  })
  @ApiUnauthorizedResponse({
    description: 'El token Bearer es inexistente o inválido.',
  })
  getSettings(@Req() req: any) {
    return this.users.getMySettings(req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('me/settings')
  @ApiOperation({ summary: 'Actualizar la configuración de recomendaciones del usuario actual' })
  @ApiOkResponse({
    type: UserSettingsResponseDto,
    description:
      'Retorna la configuración demográfica y de preferencias actualizada.',
  })
  @ApiBadRequestResponse({ description: 'La validación de los datos falló.' })
  @ApiUnauthorizedResponse({
    description: 'El token Bearer es inexistente o inválido.',
  })
  updateSettings(@Req() req: any, @Body() dto: UpdateSettingsDto) {
    return this.users.updateMySettings(req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/favorites')
  @ApiOperation({
    summary:
      'Obtener los identificadores de animes favoritos del usuario actual a partir de sus interacciones',
  })
  @ApiOkResponse({
    type: FavoriteIdsResponseDto,
    description:
      'Retorna los identificadores de los animes favoritos y la cantidad total.',
  })
  @ApiUnauthorizedResponse({
    description: 'El token Bearer es inexistente o inválido.',
  })
  async getMyFavorites(@Req() req: any) {
    const favoriteAnimeIds = await this.users.getFavoriteAnimeIds(
      req.user.userId,
    );

    return {
      data: favoriteAnimeIds,
      count: favoriteAnimeIds.length,
    };
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('me/change-password')
  @ApiOperation({ summary: 'Cambiar la contraseña del usuario actual' })
  @ApiOkResponse({
    type: ChangePasswordResponseDto,
    description:
      'Retorna un mensaje de confirmación cuando la contraseña ha sido actualizada.',
  })
  @ApiBadRequestResponse({
    description:
      'La validación de los datos falló, la contraseña actual es incorrecta o la nueva contraseña es inválida.',
  })
  @ApiUnauthorizedResponse({
    description: 'El token Bearer es inexistente o inválido.',
  })
  async changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    try {
      return await this.users.changePassword(
        req.user.userId,
        dto.currentPassword,
        dto.newPassword,
      );
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
  }
}