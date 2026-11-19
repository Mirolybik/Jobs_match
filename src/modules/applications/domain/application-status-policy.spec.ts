import { ApplicationStatus } from '@prisma/client';
import { ApplicationStatusPolicy } from './application-status-policy';

describe('ApplicationStatusPolicy', () => {
  it('разрешает отозвать ожидающий отклик и приглашение', () => {
    expect(ApplicationStatusPolicy.canWithdraw(ApplicationStatus.PENDING)).toBe(true);
    expect(ApplicationStatusPolicy.canWithdraw(ApplicationStatus.INVITED)).toBe(true);
  });

  it('не разрешает отозвать уже закрытый отклик', () => {
    expect(ApplicationStatusPolicy.canWithdraw(ApplicationStatus.REJECTED)).toBe(false);
    expect(ApplicationStatusPolicy.canWithdraw(ApplicationStatus.WITHDRAWN)).toBe(false);
  });

  it('решение принимается только по ожидающему отклику', () => {
    expect(ApplicationStatusPolicy.canBeDecided(ApplicationStatus.PENDING)).toBe(true);
    expect(ApplicationStatusPolicy.canBeDecided(ApplicationStatus.INVITED)).toBe(false);
  });
});
