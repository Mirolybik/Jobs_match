import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { AccessTokenPayload, RefreshTokenPayload } from '../../common/types/authenticated-user';
import { UnauthorizedError } from '../../common/errors/domain.error';

export interface SessionUser {
  id: string;
  email: string;
  role: Role;
}

export interface IssuedRefreshToken {
  token: string;
  expiresAt: Date;
}

@Injectable()
export class TokenService {
  readonly accessTtlSeconds: number;
  private readonly refreshTtlSeconds: number;
  private readonly accessSecret: string;
  private readonly refreshSecret: string;

  constructor(
    private readonly jwtService: JwtService,
    configService: ConfigService,
  ) {
    this.accessTtlSeconds = Number(configService.getOrThrow('JWT_ACCESS_TTL_SECONDS'));
    this.refreshTtlSeconds = Number(configService.getOrThrow('JWT_REFRESH_TTL_SECONDS'));
    this.accessSecret = configService.getOrThrow('JWT_ACCESS_SECRET');
    this.refreshSecret = configService.getOrThrow('JWT_REFRESH_SECRET');
  }

  issueAccessToken(user: SessionUser): Promise<string> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      type: 'access',
    };

    return this.jwtService.signAsync(payload, {
      secret: this.accessSecret,
      expiresIn: this.accessTtlSeconds,
    });
  }

  async issueRefreshToken(userId: string): Promise<IssuedRefreshToken> {
    const token = await this.jwtService.signAsync(
      { sub: userId, type: 'refresh' } satisfies Omit<RefreshTokenPayload, 'jti'>,
      {
        secret: this.refreshSecret,
        expiresIn: this.refreshTtlSeconds,
        jwtid: randomUUID(),
      },
    );

    return {
      token,
      expiresAt: new Date(Date.now() + this.refreshTtlSeconds * 1000),
    };
  }

  async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(token, {
        secret: this.refreshSecret,
      });

      if (payload.type !== 'refresh') {
        throw new Error('Ожидался refresh-токен');
      }

      return payload;
    } catch {
      throw new UnauthorizedError('Недействительный или истёкший refresh-токен');
    }
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
