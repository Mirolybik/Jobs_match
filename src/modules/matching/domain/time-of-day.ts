import { ValidationError } from '../../../common/errors/domain.error';

const TIME_PATTERN = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/;
const MINUTES_PER_DAY = 24 * 60;

/** Время суток как значение-объект: снаружи «18:00», внутри — минуты. */
export class TimeOfDay {
  private constructor(readonly minutes: number) {}

  static parse(value: string): TimeOfDay {
    if (!TIME_PATTERN.test(value)) {
      throw new ValidationError(`Ожидается время в формате HH:mm, получено: ${value}`);
    }

    const [hours = 0, minutes = 0] = value.split(':').map(Number);
    return new TimeOfDay(hours * 60 + minutes);
  }

  static fromMinutes(minutes: number): TimeOfDay {
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > MINUTES_PER_DAY) {
      throw new ValidationError(`Некорректное количество минут: ${minutes}`);
    }
    return new TimeOfDay(minutes);
  }

  format(): string {
    const hours = Math.floor(this.minutes / 60);
    const minutes = this.minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  toString(): string {
    return this.format();
  }
}
