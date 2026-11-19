import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Matches, Max, Min } from 'class-validator';

const TIME_PATTERN = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/;

export class ScheduleSlotDto {
  @ApiProperty({ description: '1 = понедельник, 7 = воскресенье', minimum: 1, maximum: 7 })
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek!: number;

  @ApiProperty({ example: '18:00' })
  @Matches(TIME_PATTERN, { message: 'Время начала должно быть в формате HH:mm' })
  start!: string;

  @ApiProperty({ example: '22:00' })
  @Matches(TIME_PATTERN, { message: 'Время окончания должно быть в формате HH:mm' })
  end!: string;
}
