import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { IS_OPTIONAL_AUTH_KEY } from '../decorators/optional-auth.decorator';
import { AuthenticatedRequest } from '../decorators/current-user.decorator';
import { AccessTokenPayload } from '../types/authenticated-user';
import { UnauthorizedError } from '../errors/domain.error';
import { bindRequestUser } from '../request-context/request-context';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const isOptional = this.reflector.getAllAndOverride<boolean>(IS_OPTIONAL_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request);

    if (!token) {
      if (isOptional) {
        return true;
      }
      throw new UnauthorizedError();
    }

    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });

      if (payload.type !== 'access') {
        throw new Error('Ожидался access-токен');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { status: true, role: true },
      });

      if (!user || user.status !== UserStatus.ACTIVE) {
        if (isOptional) {
          return true;
        }
        throw new UnauthorizedError('Аккаунт заблокирован или недоступен');
      }

      request.user = { id: payload.sub, email: payload.email, role: user.role };
      bindRequestUser(payload.sub, user.role);
      return true;
    } catch {
      if (isOptional) {
        return true;
      }
      throw new UnauthorizedError('Недействительный или истёкший токен');
    }
  }

  private extractBearerToken(request: AuthenticatedRequest): string | undefined {
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    return scheme === 'Bearer' && token ? token : undefined;
  }
}
