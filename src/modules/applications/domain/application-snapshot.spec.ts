import { ApplicationSnapshot } from './application-snapshot';

describe('ApplicationSnapshot', () => {
  const takenAt = new Date('2026-11-19T10:00:00.000Z');
  const source = {
    hourlyRateKopecks: 40_000,
    city: 'Москва',
    address: 'ул. Тверская, 12',
    responseDeadlineHours: 48,
    schedule: [{ dayOfWeek: 2, startMinute: 18 * 60, endMinute: 22 * 60 }],
  };

  it('сохраняет условия и рассчитывает срок ответа', () => {
    const snapshot = ApplicationSnapshot.capture(source, takenAt);

    expect(snapshot.rateKopecks).toBe(40_000);
    expect(snapshot.address).toBe('ул. Тверская, 12');
    expect(snapshot.deadlineAt.toISOString()).toBe('2026-11-21T10:00:00.000Z');
    expect(snapshot.toResponse()).toMatchObject({
      hourlyRate: 400,
      weeklyHours: 4,
      estimatedWeeklyPay: 1600,
    });
  });

  it('восстанавливает снимок из БД без потери условий', () => {
    const captured = ApplicationSnapshot.capture(source, takenAt);
    const restored = ApplicationSnapshot.restore({
      snapshotRateKopecks: captured.rateKopecks,
      snapshotCity: captured.city,
      snapshotAddress: captured.address,
      snapshotSchedule: captured.schedule.toSnapshot(),
      snapshotDeadlineHours: captured.deadlineHours,
      snapshotTakenAt: captured.takenAt,
    });

    expect(restored.toResponse()).toEqual(captured.toResponse());
    expect(restored.address).toBe('ул. Тверская, 12');
  });
});
