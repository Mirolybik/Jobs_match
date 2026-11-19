import { ApplicationStatus, Role } from '@prisma/client';
import { kopecksToRubles } from '../../common/utils/money';
import {
  CandidateProfileResponse,
  CandidatePresenter,
  CompanyPresenter,
  CompanyResponse,
} from '../users/users.presenter';
import { VacancyMatch } from '../matching/domain/vacancy-match';
import { ApplicationWithDetails, StatusEventWithActor } from './application.repository';
import { ApplicationSnapshot } from './domain/application-snapshot';
import { ApplicationStatusPolicy } from './domain/application-status-policy';

const STATUS_LABELS: Readonly<Record<ApplicationStatus, string>> = {
  [ApplicationStatus.PENDING]: 'Ожидает решения',
  [ApplicationStatus.INVITED]: 'Приглашение',
  [ApplicationStatus.REJECTED]: 'Отказ',
  [ApplicationStatus.WITHDRAWN]: 'Отклик отозван',
};

export interface StatusHistoryEntryResponse {
  id: string;
  status: ApplicationStatus;
  statusLabel: string;
  previousStatus: ApplicationStatus | null;
  previousStatusLabel: string | null;
  comment: string | null;
  actor: { id: string; email: string; role: Role } | null;
  createdAt: Date;
}

export interface ApplicationVacancySummary {
  id: string;
  title: string;
  status: string;
  city: string;
  address: string;
  hourlyRate: number;
  company: CompanyResponse;
}

export interface ApplicationResponse {
  id: string;
  status: ApplicationStatus;
  statusLabel: string;
  responseOverdue: boolean;
  createdAt: Date;
  deadlineAt: Date;
  decidedAt: Date | null;
  snapshot: Record<string, unknown>;
  vacancy: ApplicationVacancySummary;
  candidate?: CandidateProfileResponse & { email: string };
  match?: Record<string, unknown>;
  history?: StatusHistoryEntryResponse[];
  canWithdraw?: boolean;
  canDecide?: boolean;
}

export interface ApplicationPresenterOptions {
  /** true — карточка для работодателя/администратора, с контактами и сверкой графика. */
  includeCandidate?: boolean;
  match?: VacancyMatch;
  /** Передаётся только для карточки отклика, чтобы не грузить историю в списках. */
  history?: StatusEventWithActor[];
}

export class ApplicationPresenter {
  static toResponse(
    application: ApplicationWithDetails,
    options: ApplicationPresenterOptions = {},
  ): ApplicationResponse {
    const snapshot = ApplicationSnapshot.restore(application);
    const now = new Date();
    const pending = application.status === ApplicationStatus.PENDING;

    return {
      id: application.id,
      status: application.status,
      statusLabel: STATUS_LABELS[application.status],
      responseOverdue: pending && now > application.deadlineAt,
      createdAt: application.createdAt,
      deadlineAt: application.deadlineAt,
      decidedAt: application.decidedAt,
      snapshot: snapshot.toResponse(),
      vacancy: {
        id: application.vacancy.id,
        title: application.vacancy.title,
        status: application.vacancy.status,
        city: application.vacancy.city,
        address: application.vacancy.address,
        hourlyRate: kopecksToRubles(application.vacancy.hourlyRateKopecks),
        company: CompanyPresenter.toResponse(application.vacancy.company),
      },
      ...(options.includeCandidate
        ? {
            candidate: CandidatePresenter.toEmployerResponse(application.candidate),
            canDecide: ApplicationStatusPolicy.canBeDecided(application.status),
          }
        : {
            canWithdraw: ApplicationStatusPolicy.canWithdraw(application.status),
          }),
      ...(options.match ? { match: options.match.toJSON() } : {}),
      ...(options.history ? { history: ApplicationPresenter.historyToResponse(options.history) } : {}),
    };
  }

  static historyToResponse(events: StatusEventWithActor[]): StatusHistoryEntryResponse[] {
    return events.map((event) => ({
      id: event.id,
      status: event.status,
      statusLabel: STATUS_LABELS[event.status],
      previousStatus: event.previousStatus,
      previousStatusLabel: event.previousStatus ? STATUS_LABELS[event.previousStatus] : null,
      comment: event.comment,
      actor: event.actor,
      createdAt: event.createdAt,
    }));
  }
}
