import { VacancyStatus } from '@prisma/client';
import { calculatePayKopecks, kopecksToRubles } from '../../common/utils/money';
import { dayLabel } from '../matching/domain/day-of-week';
import { ScheduleMapper } from '../matching/schedule.mapper';
import { VacancyMatch } from '../matching/domain/vacancy-match';
import { CompanyPresenter, CompanyResponse } from '../users/users.presenter';
import { VacancyEntity, VacancyEntityWithCount } from './vacancy.repository';

export interface VacancyScheduleResponse {
  dayOfWeek: number;
  day: string;
  start: string;
  end: string;
}

export interface VacancyResponse {
  id: string;
  title: string;
  description: string;
  city: string;
  address: string;
  hourlyRate: number;
  responseDeadlineHours: number;
  status: VacancyStatus;
  company: CompanyResponse;
  schedule: VacancyScheduleResponse[];
  weeklyHours: number;
  estimatedWeeklyPay: number;
  applicationCount?: number;
  match?: Record<string, unknown>;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

type VacancyWithOptionalCount = VacancyEntity & {
  _count?: { applications: number };
};

export class VacancyPresenter {
  static toResponse(
    vacancy: VacancyWithOptionalCount | VacancyEntityWithCount,
    match?: VacancyMatch,
  ): VacancyResponse {
    const schedule = ScheduleMapper.toDomain(vacancy.schedule);
    const weeklyHours = Math.round((schedule.totalMinutes / 60) * 100) / 100;

    return {
      id: vacancy.id,
      title: vacancy.title,
      description: vacancy.description,
      city: vacancy.city,
      address: vacancy.address,
      hourlyRate: kopecksToRubles(vacancy.hourlyRateKopecks),
      responseDeadlineHours: vacancy.responseDeadlineHours,
      status: vacancy.status,
      company: CompanyPresenter.toResponse(vacancy.company),
      schedule: schedule.intervals.map((interval) => ({
        dayOfWeek: interval.dayOfWeek,
        day: dayLabel(interval.dayOfWeek),
        start: interval.toSnapshot().start,
        end: interval.toSnapshot().end,
      })),
      weeklyHours,
      estimatedWeeklyPay: kopecksToRubles(
        calculatePayKopecks(vacancy.hourlyRateKopecks, schedule.totalMinutes),
      ),
      ...(vacancy._count ? { applicationCount: vacancy._count.applications } : {}),
      ...(match ? { match: match.toJSON() } : {}),
      publishedAt: vacancy.publishedAt,
      createdAt: vacancy.createdAt,
      updatedAt: vacancy.updatedAt,
    };
  }
}
