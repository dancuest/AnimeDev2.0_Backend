import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';

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
      },
    });

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
      },
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

  private getAuthMode(user: {
    email?: string | null;
    deviceId?: string | null;
  }): 'guest' | 'registered' {
    return user.email ? 'registered' : 'guest';
  }
}