import { Injectable } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { ConflictError, ForbiddenError, UnauthorizedError } from '../../common/errors/domain.error';
import { AuditService } from '../audit/audit.service';
import { UserPresenter, UserResponse } from '../users/users.presenter';
import { UserWithProfileAndCompany } from '../users/user.types';
import {
  LoginDto,
  RefreshTokenDto,
  RegisterCandidateDto,
  RegisterEmployerDto,
} from './dto/auth.dto';
import { PasswordHasher } from './password-hasher.service';
import { RefreshTokenRepository } from './refresh-token.repository';
import { TokenService } from './token.service';
import { UserRepository } from './user.repository';

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export interface AuthResult {
  user: UserResponse;
  tokens: SessionTokens;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenService: TokenService,
    private readonly audit: AuditService,
  ) {}

  async registerCandidate(dto: RegisterCandidateDto): Promise<AuthResult> {
    const email = this.normalizeEmail(dto.email);
    await this.ensureEmailIsFree(email);

    const user = await this.users.createCandidate({
      email,
      passwordHash: await this.passwordHasher.hash(dto.password),
      fullName: dto.fullName.trim(),
      city: dto.city.trim(),
      phone: dto.phone?.trim(),
    });

    const session = await this.startSession(user);
    await this.audit.record({
      action: 'USER_REGISTERED',
      entityType: 'User',
      entityId: user.id,
      actorId: user.id,
      actorRole: user.role,
      metadata: { role: user.role },
    });

    return session;
  }

  async registerEmployer(dto: RegisterEmployerDto): Promise<AuthResult> {
    const email = this.normalizeEmail(dto.email);
    await this.ensureEmailIsFree(email);

    const user = await this.users.createEmployer({
      email,
      passwordHash: await this.passwordHasher.hash(dto.password),
      companyName: dto.companyName.trim(),
      city: dto.city.trim(),
      address: dto.address.trim(),
      description: dto.description?.trim(),
    });

    const session = await this.startSession(user);
    await this.audit.record({
      action: 'USER_REGISTERED',
      entityType: 'User',
      entityId: user.id,
      actorId: user.id,
      actorRole: user.role,
      metadata: { role: user.role, companyId: user.company?.id ?? null },
    });

    return session;
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.users.findByEmail(this.normalizeEmail(dto.email));

    if (!user || !(await this.passwordHasher.verify(dto.password, user.passwordHash))) {
      throw new UnauthorizedError('Неверный email или пароль');
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenError('Аккаунт заблокирован');
    }

    const userWithProfile = await this.users.findByIdWithProfile(user.id);
    if (!userWithProfile) {
      throw new UnauthorizedError('Пользователь не найден');
    }

    const session = await this.startSession(userWithProfile);
    await this.audit.record({
      action: 'USER_LOGIN',
      entityType: 'User',
      entityId: user.id,
      actorId: user.id,
      actorRole: user.role,
    });

    return session;
  }

  async refresh(dto: RefreshTokenDto): Promise<AuthResult> {
    const payload = await this.tokenService.verifyRefreshToken(dto.refreshToken);
    const tokenHash = this.tokenService.hashToken(dto.refreshToken);
    const storedToken = await this.refreshTokens.findActiveByTokenHash(tokenHash);

    if (!storedToken || storedToken.userId !== payload.sub) {
      throw new UnauthorizedError('Refresh-токен отозван или не найден');
    }

    const user = await this.users.findByIdWithProfile(payload.sub);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedError('Пользователь недоступен');
    }

    await this.refreshTokens.revokeById(storedToken.id);

    const session = await this.startSession(user);
    await this.audit.record({
      action: 'USER_TOKEN_REFRESHED',
      entityType: 'User',
      entityId: user.id,
      actorId: user.id,
      actorRole: user.role,
    });

    return session;
  }

  /** Идемпотентный выход: отзываем refresh-токен, если он существует. */
  async logout(dto: RefreshTokenDto): Promise<void> {
    const tokenHash = this.tokenService.hashToken(dto.refreshToken);
    const storedToken = await this.refreshTokens.findActiveByTokenHash(tokenHash);

    await this.refreshTokens.revokeByTokenHash(tokenHash);

    if (storedToken) {
      await this.audit.record({
        action: 'USER_LOGOUT',
        entityType: 'User',
        entityId: storedToken.userId,
        actorId: storedToken.userId,
      });
    }
  }

  async getCurrentUser(userId: string): Promise<UserResponse> {
    const user = await this.users.findByIdWithProfile(userId);
    if (!user) {
      throw new UnauthorizedError('Пользователь не найден');
    }
    return UserPresenter.toResponse(user);
  }

  private async ensureEmailIsFree(email: string): Promise<void> {
    if (await this.users.findByEmail(email)) {
      throw new ConflictError('Пользователь с таким email уже зарегистрирован');
    }
  }

  private async startSession(user: UserWithProfileAndCompany): Promise<AuthResult> {
    const accessToken = await this.tokenService.issueAccessToken(user);
    const refreshToken = await this.tokenService.issueRefreshToken(user.id);

    await this.refreshTokens.create(
      user.id,
      this.tokenService.hashToken(refreshToken.token),
      refreshToken.expiresAt,
    );

    return {
      user: UserPresenter.toResponse(user),
      tokens: {
        accessToken,
        refreshToken: refreshToken.token,
        tokenType: 'Bearer',
        expiresIn: this.tokenService.accessTtlSeconds,
      },
    };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
