import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
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
import { ScheduleSlotDto } from '../../../common/dto/schedule-slot.dto';

export class UpdateCandidateProfileDto {
  @ApiPropertyOptional({ example: 'Анна Смирнова' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName?: string;

  @ApiPropertyOptional({ example: '+7 999 123-45-67', nullable: true })
  @IsOptional()
  @Matches(/^\+?[0-9\s\-()]{7,20}$/, { message: 'Некорректный телефон' })
  phone?: string | null;

  @ApiPropertyOptional({ example: 'Москва' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  city?: string;

  @ApiPropertyOptional({ example: 'Студентка, ищу подработку по вечерам', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  about?: string | null;

  @ApiPropertyOptional({
    description: 'Минимальная ставка в рублях за час',
    example: 350,
    nullable: true,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000)
  minHourlyRate?: number | null;
}

export class ReplaceAvailabilityDto {
  @ApiProperty({ type: [ScheduleSlotDto] })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ScheduleSlotDto)
  intervals!: ScheduleSlotDto[];
}
