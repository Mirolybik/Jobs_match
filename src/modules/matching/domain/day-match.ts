import { WeeklyInterval } from './weekly-interval';
import { DayOfWeek, dayLabel } from './day-of-week';

export class DayMatch {
  constructor(
    readonly dayOfWeek: DayOfWeek,
    readonly vacancyIntervals: readonly WeeklyInterval[],
    readonly availabilityIntervals: readonly WeeklyInterval[],
    readonly missingIntervals: readonly WeeklyInterval[],
  ) {}

  get matched(): boolean {
    return this.missingIntervals.length === 0;
  }

  toJSON(): Record<string, unknown> {
    return {
      dayOfWeek: this.dayOfWeek,
      day: dayLabel(this.dayOfWeek),
      matched: this.matched,
      vacancyIntervals: this.vacancyIntervals.map((interval) => interval.toSnapshot()),
      availabilityIntervals: this.availabilityIntervals.map((interval) => interval.toSnapshot()),
      missingIntervals: this.missingIntervals.map((interval) => interval.toSnapshot()),
    };
  }
}
