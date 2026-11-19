import { calculatePayKopecks, kopecksToRubles } from '../../../common/utils/money';
import { dayLabel } from '../../matching/domain/day-of-week';
import { ScheduleMapper, ScheduleRecord } from '../../matching/schedule.mapper';
import { WeeklySchedule } from '../../matching/domain/weekly-schedule';

export interface SnapshotSource {
  hourlyRateKopecks: number;
  city: string;
  address: string;
  responseDeadlineHours: number;
  schedule: readonly ScheduleRecord[];
}

export interface SnapshotRecord {
  snapshotRateKopecks: number;
  snapshotCity: string;
  snapshotAddress: string;
  snapshotSchedule: unknown;
  snapshotDeadlineHours: number;
  snapshotTakenAt: Date;
}

/**
 * Копия условий вакансии на момент отклика.
 * Ставка, адрес и график остаются неизменными, даже если вакансию отредактируют.
 */
export class ApplicationSnapshot {
  private constructor(
    readonly rateKopecks: number,
    readonly city: string,
    readonly address: string,
    readonly schedule: WeeklySchedule,
    readonly deadlineHours: number,
    readonly takenAt: Date,
  ) {}

  static capture(source: SnapshotSource, takenAt: Date = new Date()): ApplicationSnapshot {
    return new ApplicationSnapshot(
      source.hourlyRateKopecks,
      source.city,
      source.address,
      ScheduleMapper.toDomain(source.schedule),
      source.responseDeadlineHours,
      takenAt,
    );
  }

  static restore(record: SnapshotRecord): ApplicationSnapshot {
    return new ApplicationSnapshot(
      record.snapshotRateKopecks,
      record.snapshotCity,
      record.snapshotAddress,
      WeeklySchedule.fromSnapshots(record.snapshotSchedule),
      record.snapshotDeadlineHours,
      record.snapshotTakenAt,
    );
  }

  get deadlineAt(): Date {
    return new Date(this.takenAt.getTime() + this.deadlineHours * 60 * 60 * 1000);
  }

  toPersistence(): {
    rateKopecks: number;
    city: string;
    address: string;
    schedule: ReturnType<WeeklySchedule['toSnapshot']>;
    deadlineHours: number;
    takenAt: Date;
  } {
    return {
      rateKopecks: this.rateKopecks,
      city: this.city,
      address: this.address,
      schedule: this.schedule.toSnapshot(),
      deadlineHours: this.deadlineHours,
      takenAt: this.takenAt,
    };
  }

  toResponse(): Record<string, unknown> {
    return {
      hourlyRate: kopecksToRubles(this.rateKopecks),
      city: this.city,
      address: this.address,
      deadlineHours: this.deadlineHours,
      takenAt: this.takenAt,
      weeklyHours: Math.round((this.schedule.totalMinutes / 60) * 100) / 100,
      estimatedWeeklyPay: kopecksToRubles(
        calculatePayKopecks(this.rateKopecks, this.schedule.totalMinutes),
      ),
      schedule: this.schedule.intervals.map((interval) => ({
        dayOfWeek: interval.dayOfWeek,
        day: dayLabel(interval.dayOfWeek),
        start: interval.toSnapshot().start,
        end: interval.toSnapshot().end,
      })),
    };
  }
}
