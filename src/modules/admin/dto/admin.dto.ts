import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CompanyStatus, Role, UserStatus } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class AdminUserQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ description: 'Поиск по email или имени' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

export class UpdateUserStatusDto {
  @ApiProperty({ enum: [UserStatus.ACTIVE, UserStatus.BLOCKED] })
  @IsIn([UserStatus.ACTIVE, UserStatus.BLOCKED])
  status!: 'ACTIVE' | 'BLOCKED';
}

export class AdminCompanyQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: CompanyStatus })
  @IsOptional()
  @IsEnum(CompanyStatus)
  status?: CompanyStatus;

  @ApiPropertyOptional({ description: 'Поиск по названию' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

export class UpdateCompanyStatusDto {
  @ApiProperty({ enum: [CompanyStatus.ACTIVE, CompanyStatus.SUSPENDED] })
  @IsIn([CompanyStatus.ACTIVE, CompanyStatus.SUSPENDED])
  status!: 'ACTIVE' | 'SUSPENDED';
}
