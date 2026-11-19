import { DayOfWeek } from './day-of-week';
import { TimeOfDay } from './time-of-day';
import { WeeklyInterval } from './weekly-interval';
import { WeeklySchedule } from './weekly-schedule';
import { MatchStatus, VacancyMatch } from './vacancy-match';

const interval = (day: DayOfWeek, start: string, end: string): WeeklyInterval =>
  WeeklyInterval.fromTimes(day, TimeOfDay.parse(start), TimeOfDay.parse(end));

const schedule = (...slots: [DayOfWeek, string, string][]): WeeklySchedule =>
  WeeklySchedule.fromIntervals(slots.map(([day, start, end]) => interval(day, start, end)));

describe('VacancyMatch', () => {
  const candidate = schedule(
    [DayOfWeek.TUESDAY, '18:00', '22:00'],
    [DayOfWeek.THURSDAY, '18:00', '22:00'],
    [DayOfWeek.SATURDAY, '10:00', '18:00'],
  );

  it('совпадает и считает недельный доход (пример из ТЗ)', () => {
    const vacancy = schedule(
      [DayOfWeek.TUESDAY, '18:00', '22:00'],
      [DayOfWeek.THURSDAY, '18:00', '22:00'],
    );

    const match = VacancyMatch.evaluate(vacancy, candidate, {
      hourlyRateKopecks: 40_000,
      minHourlyRateKopecks: 35_000,
    });

    expect(match.status).toBe(MatchStatus.MATCHED);
    expect(match.matched).toBe(true);
    expect(match.weeklyHours).toBe(8);
    expect(match.toJSON()).toMatchObject({
      hourlyRate: 400,
      estimatedWeeklyPay: 3200,
      weeklyMinutes: 480,
    });
    expect(match.reasons[0]).toContain('входят в ваш график');
    expect(match.warnings).toHaveLength(0);
  });

  it('объясняет расхождение по дню и интервалу', () => {
    const vacancy = schedule([DayOfWeek.WEDNESDAY, '12:00', '17:00']);

    const match = VacancyMatch.evaluate(vacancy, candidate, {
      hourlyRateKopecks: 40_000,
    });

    expect(match.status).toBe(MatchStatus.MISMATCHED);
    expect(match.matched).toBe(false);
    expect(match.reasons[0]).toBe('Среда: не хватает 12:00–17:00.');
    expect(match.toJSON().days).toEqual(
      expect.arrayContaining([expect.objectContaining({ day: 'Среда', matched: false })]),
    );
  });

  it('не сравнивает график, если доступные часы не заполнены', () => {
    const vacancy = schedule([DayOfWeek.TUESDAY, '18:00', '22:00']);

    const match = VacancyMatch.evaluate(vacancy, WeeklySchedule.empty(), {
      hourlyRateKopecks: 40_000,
    });

    expect(match.status).toBe(MatchStatus.NO_AVAILABILITY);
    expect(match.reasons[0]).toContain('не заполнены');
  });

  it('предупреждает о ставке ниже минимума, не ломая совпадение', () => {
    const vacancy = schedule([DayOfWeek.TUESDAY, '18:00', '22:00']);

    const match = VacancyMatch.evaluate(vacancy, candidate, {
      hourlyRateKopecks: 30_000,
      minHourlyRateKopecks: 35_000,
    });

    expect(match.matched).toBe(true);
    expect(match.warnings[0]).toContain('ниже вашего минимума');
  });

  it('округляет недельную оплату до копеек', () => {
    const vacancy = schedule([DayOfWeek.TUESDAY, '18:00', '19:30']);

    const match = VacancyMatch.evaluate(vacancy, candidate, {
      hourlyRateKopecks: 33_333,
    });

    expect(match.estimatedWeeklyPayKopecks).toBe(50_000);
  });
});
