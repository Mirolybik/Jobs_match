import { Role } from '@prisma/client';

export interface AuthenticatedUser {
  readonly id: string;
  readonly email: string;
  readonly role: Role;
}

export interface AccessTokenPayload {
  readonly sub: string;
  readonly email: string;
  readonly role: Role;
  readonly type: 'access';
}

export interface RefreshTokenPayload {
  readonly sub: string;
  readonly jti: string;
  readonly type: 'refresh';
}
