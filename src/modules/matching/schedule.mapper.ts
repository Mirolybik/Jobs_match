import { DayOfWeek } from './domain/day-of-week';
import { WeeklyInterval } from './domain/weekly-interval';
import { WeeklySchedule } from './domain/weekly-schedule';

export interface ScheduleRecord {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
}

/** Преобразование записей расписания из БД в доменный график. */
export class ScheduleMapper {
  static toDomain(records: readonly ScheduleRecord[]): WeeklySchedule {
    return WeeklySchedule.fromIntervals(
      records.map((record) =>
        WeeklyInterval.create({
          dayOfWeek: record.dayOfWeek as DayOfWeek,
          startMinute: record.startMinute,
          endMinute: record.endMinute,
        }),
      ),
    );
  }

  static toPersistence(schedule: WeeklySchedule): ScheduleRecord[] {
    return schedule.intervals.map((interval) => ({
      dayOfWeek: interval.dayOfWeek,
      startMinute: interval.startMinute,
      endMinute: interval.endMinute,
    }));
  }
}
