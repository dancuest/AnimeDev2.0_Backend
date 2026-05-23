import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { DeviceLoginDto } from './dto/device-login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import {
  AuthMeResponseDto,
  AuthSessionResponseDto,
  BasicMessageResponseDto,
  ForgotPasswordResponseDto,
} from './dto/auth-swagger.dto';

@ApiTags('autenticación')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) { }

  @Post('device')
  @ApiOperation({ summary: 'Crear o reanudar una sesión por dispositivo' })
  @ApiCreatedResponse({
    type: AuthSessionResponseDto,
    description:
      'Retorna un JWT y la información del perfil del usuario del dispositivo.',
  })
  @ApiBadRequestResponse({ description: 'La validación de los datos falló.' })
  loginDevice(@Body() dto: DeviceLoginDto) {
    return this.auth.loginWithDevice(dto.deviceId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Post('register')
  @ApiOperation({
    summary:
      'Registrar credenciales de correo y contraseña para el usuario de dispositivo autenticado actualmente',
  })
  @ApiCreatedResponse({
    type: AuthSessionResponseDto,
    description:
      'Retorna un JWT y la información del perfil del usuario registrado.',
  })
  @ApiBadRequestResponse({
    description: 'La validación de los datos falló o el correo ya existe.',
  })
  @ApiUnauthorizedResponse({
    description: 'El token Bearer es inexistente o inválido.',
  })
  register(
    @Req() req: Request & { user?: { userId: string } },
    @Body() dto: RegisterDto,
  ) {
    return this.auth.register(req.user!.userId, dto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Iniciar sesión con correo y contraseña' })
  @ApiCreatedResponse({
    type: AuthSessionResponseDto,
    description: 'Retorna un JWT y la información del perfil.',
  })
  @ApiBadRequestResponse({
    description:
      'La validación de los datos falló o las credenciales son inválidas.',
  })
  login(@Body() dto: LoginDto) {
    return this.auth.loginWithEmail(dto.email, dto.password);
  }

  @Post('forgot-password')
  @ApiOperation({
    summary: 'Generar token de restablecimiento de contraseña en modo demostración',
  })
  @ApiCreatedResponse({
    type: ForgotPasswordResponseDto,
    description: 'Retorna los metadatos del token para la recuperación de contraseña.',
  })
  @ApiBadRequestResponse({
    description:
      'La validación de los datos falló o el usuario no tiene configurado el flujo de contraseña por correo.',
  })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Restablecer contraseña usando un token válido' })
  @ApiCreatedResponse({
    type: BasicMessageResponseDto,
    description: 'Indica si la contraseña fue restablecida correctamente.',
  })
  @ApiBadRequestResponse({
    description:
      'La validación de los datos falló o la combinación de token y correo es inválida.',
  })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.email, dto.token, dto.newPassword);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Post('logout')
  @ApiOperation({ summary: 'Cerrar la sesión actual' })
  @ApiCreatedResponse({
    type: BasicMessageResponseDto,
    description: 'Retorna el mensaje de confirmación de cierre de sesión.',
  })
  @ApiUnauthorizedResponse({
    description: 'El token Bearer es inexistente o inválido.',
  })
  logout() {
    return this.auth.logout();
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Get('me')
  @ApiOperation({ summary: 'Obtener el perfil del usuario autenticado' })
  @ApiOkResponse({
    type: AuthMeResponseDto,
    description: 'Retorna los datos del perfil del usuario autenticado.',
  })
  @ApiUnauthorizedResponse({
    description: 'El token Bearer es inexistente o inválido.',
  })
  me(@Req() req: Request & { user?: { userId: string } }) {
    return this.auth.me(req.user!.userId);
  }
}