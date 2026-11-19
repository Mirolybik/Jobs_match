import { DayOfWeek } from './day-of-week';
import { TimeOfDay } from './time-of-day';
import { WeeklyInterval } from './weekly-interval';
import { WeeklySchedule } from './weekly-schedule';

const interval = (day: DayOfWeek, start: string, end: string): WeeklyInterval =>
  WeeklyInterval.fromTimes(day, TimeOfDay.parse(start), TimeOfDay.parse(end));

const schedule = (...slots: [DayOfWeek, string, string][]): WeeklySchedule =>
  WeeklySchedule.fromIntervals(slots.map(([day, start, end]) => interval(day, start, end)));

describe('WeeklySchedule', () => {
  it('объединяет пересекающиеся и смежные интервалы', () => {
    const result = schedule(
      [DayOfWeek.TUESDAY, '18:00', '20:00'],
      [DayOfWeek.TUESDAY, '20:00', '22:00'],
    );

    expect(result.intervals).toHaveLength(1);
    expect(result.intervals[0]?.toString()).toBe('18:00–22:00');
  });

  it('считает график полностью вложенным', () => {
    const candidate = schedule(
      [DayOfWeek.TUESDAY, '18:00', '22:00'],
      [DayOfWeek.THURSDAY, '18:00', '22:00'],
      [DayOfWeek.SATURDAY, '10:00', '18:00'],
    );
    const vacancy = schedule(
      [DayOfWeek.TUESDAY, '18:00', '22:00'],
      [DayOfWeek.THURSDAY, '18:00', '22:00'],
    );

    expect(candidate.containsSchedule(vacancy)).toBe(true);
    expect(candidate.missingSegments(vacancy)).toHaveLength(0);
  });

  it('находит непокрытые куски чужого графика', () => {
    const candidate = schedule([DayOfWeek.TUESDAY, '18:00', '22:00']);
    const vacancy = schedule([DayOfWeek.TUESDAY, '19:00', '23:00']);

    const missing = candidate.missingSegments(vacancy);

    expect(missing).toHaveLength(1);
    expect(missing[0]?.toString()).toBe('22:00–23:00');
  });

  it('засчитывает вакансию, разбитую по смежным слотам соискателя', () => {
    const candidate = schedule(
      [DayOfWeek.WEDNESDAY, '18:00', '20:00'],
      [DayOfWeek.WEDNESDAY, '20:00', '22:00'],
    );
    const vacancy = schedule([DayOfWeek.WEDNESDAY, '19:00', '21:00']);

    expect(candidate.containsSchedule(vacancy)).toBe(true);
  });

  it('восстанавливается из снимка', () => {
    const original = schedule(
      [DayOfWeek.SATURDAY, '10:00', '18:00'],
      [DayOfWeek.TUESDAY, '18:00', '22:00'],
    );

    const restored = WeeklySchedule.fromSnapshots(original.toSnapshot());

    expect(restored.toSnapshot()).toEqual(original.toSnapshot());
  });
});
