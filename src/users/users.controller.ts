import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

import { AuthGuard } from '@nestjs/passport';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @UseGuards(AuthGuard('jwt')) 
  @Get('me')
  me(@Req() req: any) {
    return this.users.getMe(req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('me/profile')
  updateProfile(@Req() req: any, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(req.user.userId, dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me/settings')
  getSettings(@Req() req: any) {
    return this.users.getMySettings(req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('me/settings')
  updateSettings(@Req() req: any, @Body() dto: UpdateSettingsDto) {
    return this.users.updateMySettings(req.user.userId, dto);
  }
}