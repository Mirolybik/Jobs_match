import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordHasher } from './password-hasher.service';
import { RefreshTokenRepository } from './refresh-token.repository';
import { TokenService } from './token.service';
import { UserRepository } from './user.repository';

@Module({
  controllers: [AuthController],
  providers: [AuthService, UserRepository, RefreshTokenRepository, PasswordHasher, TokenService],
  exports: [UserRepository],
})
export class AuthModule {}
