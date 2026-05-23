import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

type RegisterPayload = {
  email: string;
  password: string;
  displayName?: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async loginWithDevice(deviceId: string) {
    const user = await this.prisma.user.upsert({
      where: { deviceId },
      update: {},
      create: {
        deviceId,
        settings: { create: {} },
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        deviceId: true,
        avatarUrl: true,
        coverImageUrl: true,
      },
    });

    return this.buildAuthResponse(user);
  }

  async register(userId: string, dto: RegisterPayload) {
    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
      },
    });

    if (!currentUser) {
      throw new UnauthorizedException('Invalid token');
    }

    if (currentUser.email) {
      throw new ConflictException(
        'La sesión actual ya está registrada. Inicia el registro desde una sesión nueva de invitado.',
      );
    }

    const normalizedEmail = this.normalizeEmail(dto.email);

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existingUser && existingUser.id !== userId) {
      throw new ConflictException('Ese correo ya está registrado');
    }

    const hashedPassword = this.hashPassword(dto.password);

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        displayName: dto.displayName?.trim() || undefined,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        deviceId: true,
        avatarUrl: true,
        coverImageUrl: true,
      },
    });

    return this.buildAuthResponse(updatedUser);
  }

  async loginWithEmail(email: string, password: string) {
    const normalizedEmail = this.normalizeEmail(email);

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        displayName: true,
        deviceId: true,
        avatarUrl: true,
        coverImageUrl: true,
        password: true,
      },
    });

    if (!user?.password) {
      throw new UnauthorizedException('Correo o contraseña inválidos');
    }

    const validPassword = this.verifyPassword(password, user.password);

    if (!validPassword) {
      throw new UnauthorizedException('Correo o contraseña inválidos');
    }

    return this.buildAuthResponse(user);
  }

  async forgotPassword(email: string) {
    const normalizedEmail = this.normalizeEmail(email);

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true },
    });

    if (!user) {
      return {
        success: true,
        message: 'Si el correo existe, se generó un token de recuperación',
      };
    }

    const token = randomBytes(4).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: token,
        passwordResetExpiresAt: expiresAt,
      },
    });

    return {
      success: true,
      message: 'Token de recuperación generado',
      resetToken: token,
      expiresAt,
      note: 'Modo demo: este token se devuelve en la respuesta en lugar de enviarse por correo',
    };
  }

  async resetPassword(email: string, token: string, newPassword: string) {
    const normalizedEmail = this.normalizeEmail(email);

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        passwordResetToken: true,
        passwordResetExpiresAt: true,
      },
    });

    if (!user?.passwordResetToken || !user.passwordResetExpiresAt) {
      throw new UnauthorizedException('Token de recuperación inválido');
    }

    if (user.passwordResetToken !== token.trim()) {
      throw new UnauthorizedException('Token de recuperación inválido');
    }

    if (user.passwordResetExpiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('El token de recuperación expiró');
    }

    const hashedPassword = this.hashPassword(newPassword);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
      },
    });

    return {
      success: true,
      message: 'Contraseña actualizada correctamente',
    };
  }

  async logout() {
    return {
      success: true,
      message: 'Logged out',
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        deviceId: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        coverImageUrl: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid token');
    }

    return {
      ...user,
      authMode: this.getAuthMode(user),
    };
  }

  private async buildAuthResponse(user: {
    id: string;
    email?: string | null;
    displayName?: string | null;
    deviceId?: string | null;
    avatarUrl?: string | null;
    coverImageUrl?: string | null;
  }) {
    const access_token = await this.jwt.signAsync({}, { subject: user.id });

    return {
      userId: user.id,
      access_token,
      authMode: this.getAuthMode(user),
      profile: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        deviceId: user.deviceId,
        avatarUrl: user.avatarUrl,
        coverImageUrl: user.coverImageUrl,
      },
    };
  }

  private getAuthMode(user: {
    email?: string | null;
    deviceId?: string | null;
  }): 'guest' | 'registered' {
    return user.email ? 'registered' : 'guest';
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private hashPassword(password: string): string {
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }

  private verifyPassword(password: string, storedHash: string): boolean {
    const [salt, originalHash] = storedHash.split(':');

    if (!salt || !originalHash) {
      return false;
    }

    const computedHash = scryptSync(password, salt, 64);
    const originalHashBuffer = Buffer.from(originalHash, 'hex');

    if (computedHash.length !== originalHashBuffer.length) {
      return false;
    }

    return timingSafeEqual(computedHash, originalHashBuffer);
  }
}