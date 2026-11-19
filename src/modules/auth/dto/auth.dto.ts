import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).+$/;
const PASSWORD_MESSAGE = 'Пароль должен содержать хотя бы одну букву и одну цифру';

export class RegisterCandidateDto {
  @ApiProperty({ example: 'anna@example.com' })
  @IsEmail({}, { message: 'Некорректный email' })
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'Candidate123', minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_MESSAGE })
  password!: string;

  @ApiProperty({ example: 'Анна Смирнова' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @ApiProperty({ example: 'Москва' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  city!: string;

  @ApiPropertyOptional({ example: '+7 999 123-45-67' })
  @IsOptional()
  @Matches(/^\+?[0-9\s\-()]{7,20}$/, { message: 'Некорректный телефон' })
  phone?: string;
}

export class RegisterEmployerDto {
  @ApiProperty({ example: 'hr@ritm.ru' })
  @IsEmail({}, { message: 'Некорректный email' })
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'Employer123', minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_MESSAGE })
  password!: string;

  @ApiProperty({ example: 'Кофейня «Ритм»' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  companyName!: string;

  @ApiProperty({ example: 'Москва' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  city!: string;

  @ApiProperty({ example: 'ул. Тверская, 12' })
  @IsString()
  @MinLength(3)
  @MaxLength(250)
  address!: string;

  @ApiPropertyOptional({ example: 'Кофейня в центре города' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'anna@example.com' })
  @IsEmail({}, { message: 'Некорректный email' })
  email!: string;

  @ApiProperty({ example: 'Candidate123' })
  @IsString()
  @MinLength(1)
  password!: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh-токен, полученный при входе' })
  @IsString()
  @MinLength(1)
  refreshToken!: string;
}
