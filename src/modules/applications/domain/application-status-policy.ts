import { ApplicationStatus } from '@prisma/client';

/** Разрешённые переходы статусов отклика. */
export class ApplicationStatusPolicy {
  static canWithdraw(status: ApplicationStatus): boolean {
    return status === ApplicationStatus.PENDING || status === ApplicationStatus.INVITED;
  }

  static canBeDecided(status: ApplicationStatus): boolean {
    return status === ApplicationStatus.PENDING;
  }
}
