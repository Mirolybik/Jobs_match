import { calculatePayKopecks, formatRubles, kopecksToRubles } from '../../../common/utils/money';
import { DayMatch } from './day-match';
import { dayLabel } from './day-of-week';
import { WeeklySchedule } from './weekly-schedule';

export enum MatchStatus {
  MATCHED = 'MATCHED',
  MISMATCHED = 'MISMATCHED',
  NO_AVAILABILITY = 'NO_AVAILABILITY',
}

export interface MatchOptions {
  hourlyRateKopecks: number;
  minHourlyRateKopecks?: number | null;
}

/**
 * Результат сверки графика вакансии с доступными часами соискателя.
 * Совпадение = все рабочие интервалы вакансии полностью входят в график соискателя.
 */
export class VacancyMatch {
  private constructor(
    readonly status: MatchStatus,
    readonly reasons: readonly string[],
    readonly warnings: readonly string[],
    readonly days: readonly DayMatch[],
    readonly weeklyMinutes: number,
    readonly hourlyRateKopecks: number,
  ) {}

  static evaluate(
    vacancySchedule: WeeklySchedule,
    candidateSchedule: WeeklySchedule,
    options: MatchOptions,
  ): VacancyMatch {
    const days = VacancyMatch.buildDays(vacancySchedule, candidateSchedule);
    const missing = candidateSchedule.missingSegments(vacancySchedule);

    const status = candidateSchedule.isEmpty
      ? MatchStatus.NO_AVAILABILITY
      : missing.length === 0
        ? MatchStatus.MATCHED
        : MatchStatus.MISMATCHED;

    const reasons =
      status === MatchStatus.NO_AVAILABILITY
        ? ['Доступные часы не заполнены — сверка графика невозможна.']
        : status === MatchStatus.MATCHED
          ? ['Все рабочие часы вакансии входят в ваш график.']
          : VacancyMatch.describeMissing(missing);

    const warnings: string[] = [];
    const { minHourlyRateKopecks } = options;
    if (
      minHourlyRateKopecks !== null &&
      minHourlyRateKopecks !== undefined &&
      options.hourlyRateKopecks < minHourlyRateKopecks
    ) {
      warnings.push(
        `Ставка ${formatRubles(options.hourlyRateKopecks)}/ч ниже вашего минимума ${formatRubles(minHourlyRateKopecks)}/ч.`,
      );
    }

    return new VacancyMatch(
      status,
      reasons,
      warnings,
      days,
      vacancySchedule.totalMinutes,
      options.hourlyRateKopecks,
    );
  }

  get matched(): boolean {
    return this.status === MatchStatus.MATCHED;
  }

  get weeklyHours(): number {
    return Math.round((this.weeklyMinutes / 60) * 100) / 100;
  }

  get estimatedWeeklyPayKopecks(): number {
    return calculatePayKopecks(this.hourlyRateKopecks, this.weeklyMinutes);
  }

  toJSON(): Record<string, unknown> {
    return {
      status: this.status,
      matched: this.matched,
      reasons: this.reasons,
      warnings: this.warnings,
      weeklyMinutes: this.weeklyMinutes,
      weeklyHours: this.weeklyHours,
      hourlyRate: kopecksToRubles(this.hourlyRateKopecks),
      estimatedWeeklyPay: kopecksToRubles(this.estimatedWeeklyPayKopecks),
      days: this.days.map((day) => day.toJSON()),
    };
  }

  private static buildDays(
    vacancySchedule: WeeklySchedule,
    candidateSchedule: WeeklySchedule,
  ): DayMatch[] {
    const dayNumbers = [
      ...new Set(vacancySchedule.intervals.map((interval) => interval.dayOfWeek)),
    ];

    return dayNumbers
      .sort((left, right) => left - right)
      .map((dayOfWeek) => {
        const vacancyIntervals = vacancySchedule.intervalsForDay(dayOfWeek);
        const availabilityIntervals = candidateSchedule.intervalsForDay(dayOfWeek);
        const missingIntervals = candidateSchedule
          .missingSegments(vacancySchedule)
          .filter((interval) => interval.dayOfWeek === dayOfWeek);

        return new DayMatch(dayOfWeek, vacancyIntervals, availabilityIntervals, missingIntervals);
      });
  }

  private static describeMissing(missing: readonly { dayOfWeek: number; toString(): string }[]) {
    const byDay = new Map<number, string[]>();

    for (const interval of missing) {
      const parts = byDay.get(interval.dayOfWeek) ?? [];
      parts.push(interval.toString());
      byDay.set(interval.dayOfWeek, parts);
    }

    return [...byDay.entries()].map(
      ([day, intervals]) => `${dayLabel(day)}: не хватает ${intervals.join(', ')}.`,
    );
  }
}
