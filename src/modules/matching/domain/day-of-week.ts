export enum DayOfWeek {
  MONDAY = 1,
  TUESDAY = 2,
  WEDNESDAY = 3,
  THURSDAY = 4,
  FRIDAY = 5,
  SATURDAY = 6,
  SUNDAY = 7,
}

export const DAY_LABELS: Readonly<Record<DayOfWeek, string>> = {
  [DayOfWeek.MONDAY]: 'Понедельник',
  [DayOfWeek.TUESDAY]: 'Вторник',
  [DayOfWeek.WEDNESDAY]: 'Среда',
  [DayOfWeek.THURSDAY]: 'Четверг',
  [DayOfWeek.FRIDAY]: 'Пятница',
  [DayOfWeek.SATURDAY]: 'Суббота',
  [DayOfWeek.SUNDAY]: 'Воскресенье',
};

export function dayLabel(day: number): string {
  return DAY_LABELS[day as DayOfWeek] ?? `День ${day}`;
}

export function isDayOfWeek(value: number): value is DayOfWeek {
  return Number.isInteger(value) && value >= DayOfWeek.MONDAY && value <= DayOfWeek.SUNDAY;
}
