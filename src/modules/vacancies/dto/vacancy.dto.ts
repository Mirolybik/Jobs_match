import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { VacancyStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { ScheduleSlotDto } from '../../../common/dto/schedule-slot.dto';

const TIME_PATTERN = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/;

export class CreateVacancyDto {
  @ApiProperty({ example: 'Бариста' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @ApiProperty({ example: 'Обслуживание гостей, приготовление напитков' })
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description!: string;

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

  @ApiProperty({ description: 'Ставка в рублях за час', example: 400 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(1_000_000)
  hourlyRate!: number;

  @ApiPropertyOptional({
    description: 'Срок ответа работодателя в часах',
    example: 48,
    default: 72,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(720)
  responseDeadlineHours?: number;

  @ApiProperty({ type: [ScheduleSlotDto], description: 'Рабочие часы вакансии на неделю' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ScheduleSlotDto)
  schedule!: ScheduleSlotDto[];
}

export class UpdateVacancyDto extends PartialType(CreateVacancyDto) {}

export class VacancyQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'Москва' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @ApiPropertyOptional({ description: 'Минимальная ставка в рублях', example: 350 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minHourlyRate?: number;

  @ApiPropertyOptional({ description: 'Поиск по названию, описанию и компании' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ description: 'День недели для фильтра', minimum: 1, maximum: 7 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek?: number;

  @ApiPropertyOptional({ example: '18:00', description: 'Начало интересующего окна' })
  @IsOptional()
  @Matches(TIME_PATTERN, { message: 'Время должно быть в формате HH:mm' })
  from?: string;

  @ApiPropertyOptional({ example: '22:00', description: 'Конец интересующего окна' })
  @IsOptional()
  @Matches(TIME_PATTERN, { message: 'Время должно быть в формате HH:mm' })
  to?: string;

  @ApiPropertyOptional({
    description: 'Только вакансии, полностью подходящие по графику (для соискателя)',
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  onlyMatching?: boolean;
}

export class AdminVacancyQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: VacancyStatus })
  @IsOptional()
  @IsEnum(VacancyStatus)
  status?: VacancyStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;
}
