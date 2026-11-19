import { ValidationError } from '../../../common/errors/domain.error';
import { DayOfWeek } from './day-of-week';
import { IntervalSnapshot, WeeklyInterval } from './weekly-interval';

/**
 * Недельный график: набор интервалов, сгруппированных по дням.
 * Пересекающиеся и смежные интервалы объединяются при создании.
 */
export class WeeklySchedule {
  private constructor(
    private readonly ordered: readonly WeeklyInterval[],
    private readonly grouped: ReadonlyMap<DayOfWeek, readonly WeeklyInterval[]>,
  ) {}

  static empty(): WeeklySchedule {
    return new WeeklySchedule([], new Map());
  }

  static fromIntervals(intervals: Iterable<WeeklyInterval>): WeeklySchedule {
    const sorted = [...intervals].sort(
      (left, right) => left.dayOfWeek - right.dayOfWeek || left.startMinute - right.startMinute,
    );

    const merged: WeeklyInterval[] = [];
    for (const interval of sorted) {
      const last = merged[merged.length - 1];
      if (last && last.dayOfWeek === interval.dayOfWeek && interval.startMinute <= last.endMinute) {
        merged[merged.length - 1] = last.merge(interval);
      } else {
        merged.push(interval);
      }
    }

    const grouped = new Map<DayOfWeek, WeeklyInterval[]>();
    for (const interval of merged) {
      const forDay = grouped.get(interval.dayOfWeek) ?? [];
      forDay.push(interval);
      grouped.set(interval.dayOfWeek, forDay);
    }

    return new WeeklySchedule(Object.freeze(merged), grouped);
  }

  static fromSnapshots(raw: unknown): WeeklySchedule {
    if (!Array.isArray(raw)) {
      throw new ValidationError('График должен быть массивом интервалов');
    }

    return WeeklySchedule.fromIntervals(
      raw.map((item) => WeeklyInterval.fromSnapshot(WeeklySchedule.parseSnapshot(item))),
    );
  }

  get intervals(): readonly WeeklyInterval[] {
    return this.ordered;
  }

  get isEmpty(): boolean {
    return this.ordered.length === 0;
  }

  get totalMinutes(): number {
    return this.ordered.reduce((total, interval) => total + interval.durationMinutes, 0);
  }

  intervalsForDay(day: DayOfWeek): readonly WeeklyInterval[] {
    return this.grouped.get(day) ?? [];
  }

  contains(interval: WeeklyInterval): boolean {
    return this.intervalsForDay(interval.dayOfWeek).some((slot) => slot.contains(interval));
  }

  containsSchedule(other: WeeklySchedule): boolean {
    return this.missingSegments(other).length === 0;
  }

  /** Возвращает куски чужого графика, которые не покрыты этим графиком. */
  missingSegments(other: WeeklySchedule): WeeklyInterval[] {
    const missing: WeeklyInterval[] = [];

    for (const target of other.intervals) {
      let cursor = target.startMinute;

      for (const slot of this.intervalsForDay(target.dayOfWeek)) {
        if (slot.endMinute <= cursor) {
          continue;
        }
        if (slot.startMinute >= target.endMinute) {
          break;
        }
        if (slot.startMinute > cursor) {
          missing.push(
            WeeklyInterval.create({
              dayOfWeek: target.dayOfWeek,
              startMinute: cursor,
              endMinute: Math.min(slot.startMinute, target.endMinute),
            }),
          );
        }
        cursor = Math.max(cursor, slot.endMinute);
        if (cursor >= target.endMinute) {
          break;
        }
      }

      if (cursor < target.endMinute) {
        missing.push(
          WeeklyInterval.create({
            dayOfWeek: target.dayOfWeek,
            startMinute: cursor,
            endMinute: target.endMinute,
          }),
        );
      }
    }

    return missing;
  }

  toSnapshot(): IntervalSnapshot[] {
    return this.ordered.map((interval) => interval.toSnapshot());
  }

  private static parseSnapshot(item: unknown): IntervalSnapshot {
    if (typeof item !== 'object' || item === null) {
      throw new ValidationError('Некорректный элемент графика');
    }

    const { dayOfWeek, start, end } = item as Record<string, unknown>;
    if (typeof dayOfWeek !== 'number' || typeof start !== 'string' || typeof end !== 'string') {
      throw new ValidationError('Элемент графика должен содержать dayOfWeek, start и end');
    }

    return { dayOfWeek, start, end };
  }
}
