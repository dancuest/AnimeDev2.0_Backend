import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
// Aquí va la lógica de autenticación del proyecto: login, registro, recuperación de cuenta y validación de sesiones.


@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}