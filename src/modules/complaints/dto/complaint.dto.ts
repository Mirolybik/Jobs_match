import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ComplaintStatus } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class CreateComplaintDto {
  @ApiPropertyOptional({ description: 'ID вакансии или ID отклика — ровно одно из двух' })
  @IsOptional()
  @IsUUID()
  vacancyId?: string;

  @ApiPropertyOptional({ description: 'ID отклика или ID вакансии — ровно одно из двух' })
  @IsOptional()
  @IsUUID()
  applicationId?: string;

  @ApiProperty({ example: 'Недостоверные условия вакансии' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  reason!: string;

  @ApiPropertyOptional({ example: 'В описании указана другая ставка' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

export class ComplaintQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ComplaintStatus })
  @IsOptional()
  @IsEnum(ComplaintStatus)
  status?: ComplaintStatus;
}

export class ResolveComplaintDto {
  @ApiProperty({ enum: [ComplaintStatus.RESOLVED, ComplaintStatus.REJECTED] })
  @IsIn([ComplaintStatus.RESOLVED, ComplaintStatus.REJECTED])
  status!: 'RESOLVED' | 'REJECTED';

  @ApiPropertyOptional({ example: 'Вакансия снята, нарушение подтверждено' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  resolutionComment?: string;

  @ApiPropertyOptional({
    description: 'Снять связанную вакансию с публикации (только для RESOLVED)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  removeVacancy?: boolean;
}
