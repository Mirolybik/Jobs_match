import { ValidationError } from '../../../common/errors/domain.error';
import { DayOfWeek, isDayOfWeek } from './day-of-week';
import { TimeOfDay } from './time-of-day';

export interface WeeklyIntervalProps {
  dayOfWeek: DayOfWeek;
  startMinute: number;
  endMinute: number;
}

export interface IntervalSnapshot {
  dayOfWeek: number;
  start: string;
  end: string;
}

const MINUTES_PER_DAY = 24 * 60;

/**
 * Неизменяемый интервал внутри дня недели.
 * Инварианты проверяются в фабриках — некорректный объект создать нельзя.
 */
export class WeeklyInterval {
  private constructor(
    readonly dayOfWeek: DayOfWeek,
    readonly startMinute: number,
    readonly endMinute: number,
  ) {}

  static create({ dayOfWeek, startMinute, endMinute }: WeeklyIntervalProps): WeeklyInterval {
    if (!isDayOfWeek(dayOfWeek)) {
      throw new ValidationError('День недели должен быть от 1 (Пн) до 7 (Вс)');
    }
    if (!Number.isInteger(startMinute) || !Number.isInteger(endMinute)) {
      throw new ValidationError('Границы интервала задаются целыми минутами');
    }
    if (startMinute < 0 || endMinute > MINUTES_PER_DAY) {
      throw new ValidationError('Интервал должен находиться в пределах суток');
    }
    if (startMinute >= endMinute) {
      throw new ValidationError('Начало интервала должно быть раньше окончания');
    }

    return new WeeklyInterval(dayOfWeek, startMinute, endMinute);
  }

  static fromTimes(dayOfWeek: DayOfWeek, start: TimeOfDay, end: TimeOfDay): WeeklyInterval {
    return WeeklyInterval.create({
      dayOfWeek,
      startMinute: start.minutes,
      endMinute: end.minutes,
    });
  }

  static fromSnapshot(snapshot: IntervalSnapshot): WeeklyInterval {
    return WeeklyInterval.create({
      dayOfWeek: snapshot.dayOfWeek as DayOfWeek,
      startMinute: TimeOfDay.parse(snapshot.start).minutes,
      endMinute: TimeOfDay.parse(snapshot.end).minutes,
    });
  }

  get durationMinutes(): number {
    return this.endMinute - this.startMinute;
  }

  contains(other: WeeklyInterval): boolean {
    return (
      this.dayOfWeek === other.dayOfWeek &&
      this.startMinute <= other.startMinute &&
      this.endMinute >= other.endMinute
    );
  }

  overlaps(other: WeeklyInterval): boolean {
    return (
      this.dayOfWeek === other.dayOfWeek &&
      this.startMinute < other.endMinute &&
      other.startMinute < this.endMinute
    );
  }

  touches(other: WeeklyInterval): boolean {
    return (
      this.dayOfWeek === other.dayOfWeek &&
      (this.startMinute === other.endMinute || other.startMinute === this.endMinute)
    );
  }

  merge(other: WeeklyInterval): WeeklyInterval {
    if (!this.overlaps(other) && !this.touches(other)) {
      throw new ValidationError('Можно объединять только пересекающиеся или смежные интервалы');
    }

    return WeeklyInterval.create({
      dayOfWeek: this.dayOfWeek,
      startMinute: Math.min(this.startMinute, other.startMinute),
      endMinute: Math.max(this.endMinute, other.endMinute),
    });
  }

  toString(): string {
    return `${TimeOfDay.fromMinutes(this.startMinute).format()}–${TimeOfDay.fromMinutes(this.endMinute).format()}`;
  }

  toSnapshot(): IntervalSnapshot {
    return {
      dayOfWeek: this.dayOfWeek,
      start: TimeOfDay.fromMinutes(this.startMinute).format(),
      end: TimeOfDay.fromMinutes(this.endMinute).format(),
    };
  }
}
