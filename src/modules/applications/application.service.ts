import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApplicationStatus, Role } from '@prisma/client';
import {
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../common/errors/domain.error';
import { PaginationQueryDto, Page, toPage } from '../../common/dto/pagination.dto';
import { AuditService } from '../audit/audit.service';
import { CandidateService } from '../candidates/candidate.service';
import { VacancyService } from '../vacancies/vacancy.service';
import { VacancyEntity } from '../vacancies/vacancy.repository';
import { ScheduleMatcher } from '../matching/schedule-matcher.service';
import { ScheduleMapper } from '../matching/schedule.mapper';
import { MatchStatus, VacancyMatch } from '../matching/domain/vacancy-match';
import { ApplicationRepository, ApplicationWithDetails } from './application.repository';
import {
  ApplicationPresenter,
  ApplicationResponse,
  StatusHistoryEntryResponse,
} from './application.presenter';
import { ApplicationSnapshot } from './domain/application-snapshot';
import { ApplicationStatusPolicy } from './domain/application-status-policy';

@Injectable()
export class ApplicationService {
  private readonly requireScheduleMatch: boolean;

  constructor(
    private readonly applications: ApplicationRepository,
    private readonly vacancies: VacancyService,
    private readonly candidates: CandidateService,
    private readonly matcher: ScheduleMatcher,
    private readonly audit: AuditService,
    configService: ConfigService,
  ) {
    const requireMatch = configService.get<boolean | string>('REQUIRE_SCHEDULE_MATCH');
    this.requireScheduleMatch = requireMatch === true || requireMatch === 'true';
  }

  async apply(userId: string, vacancyId: string): Promise<ApplicationResponse> {
    const vacancy = await this.vacancies.requirePublished(vacancyId);
    const candidate = await this.candidates.requireProfile(userId);

    if (await this.applications.findByVacancyAndCandidate(vacancyId, candidate.id)) {
      throw new ConflictError('Вы уже откликались на эту вакансию');
    }

    const match = this.matcher.match(
      ScheduleMapper.toDomain(vacancy.schedule),
      ScheduleMapper.toDomain(candidate.availability),
      {
        hourlyRateKopecks: vacancy.hourlyRateKopecks,
        minHourlyRateKopecks: candidate.minHourlyRateKopecks,
      },
    );

    if (this.requireScheduleMatch && !match.matched) {
      throw new BusinessRuleError(
        match.status === MatchStatus.NO_AVAILABILITY
          ? 'Сначала заполните доступные часы'
          : 'Рабочие часы вакансии не входят в ваш график',
        'SCHEDULE_MISMATCH',
        { match: match.toJSON() },
      );
    }

    const snapshot = ApplicationSnapshot.capture(vacancy);
    const application = await this.applications.create(
      {
        vacancyId,
        candidateId: candidate.id,
        snapshotRateKopecks: snapshot.rateKopecks,
        snapshotCity: snapshot.city,
        snapshotAddress: snapshot.address,
        snapshotSchedule: snapshot.schedule.toSnapshot(),
        snapshotDeadlineHours: snapshot.deadlineHours,
        snapshotTakenAt: snapshot.takenAt,
        deadlineAt: snapshot.deadlineAt,
      },
      { id: userId, role: Role.CANDIDATE },
    );

    await this.audit.record({
      action: 'APPLICATION_CREATED',
      entityType: 'Application',
      entityId: application.id,
      actorId: userId,
      actorRole: Role.CANDIDATE,
      metadata: { vacancyId, matchStatus: match.status },
    });

    const history = await this.applications.findHistory(application.id);
    return ApplicationPresenter.toResponse(application, { match, history });
  }

  async listMine(userId: string, query: PaginationQueryDto): Promise<Page<ApplicationResponse>> {
    const candidate = await this.candidates.requireProfile(userId);
    const { items, total } = await this.applications.findByCandidate(
      candidate.id,
      query.skip,
      query.limit,
    );

    return toPage(
      items.map((item) => ApplicationPresenter.toResponse(item)),
      total,
      query,
    );
  }

  async listForVacancy(
    userId: string,
    vacancyId: string,
    query: PaginationQueryDto,
  ): Promise<Page<ApplicationResponse>> {
    const vacancy = await this.vacancies.requireOwned(vacancyId, userId);
    const { items, total } = await this.applications.findByVacancy(
      vacancyId,
      query.skip,
      query.limit,
    );

    return toPage(
      items.map((item) =>
        ApplicationPresenter.toResponse(item, {
          includeCandidate: true,
          match: this.matchCandidate(item, vacancy),
        }),
      ),
      total,
      query,
    );
  }

  async getById(userId: string, role: Role, applicationId: string): Promise<ApplicationResponse> {
    const application = await this.requireById(applicationId);
    const audience = this.resolveAudience(application, userId, role);
    const history = await this.applications.findHistory(applicationId);

    if (audience === 'candidate') {
      return ApplicationPresenter.toResponse(application, { history });
    }

    return ApplicationPresenter.toResponse(application, {
      includeCandidate: true,
      match: this.matchCandidate(application, application.vacancy),
      history,
    });
  }

  async getHistory(
    userId: string,
    role: Role,
    applicationId: string,
  ): Promise<StatusHistoryEntryResponse[]> {
    const application = await this.requireById(applicationId);
    this.resolveAudience(application, userId, role);
    const history = await this.applications.findHistory(applicationId);
    return ApplicationPresenter.historyToResponse(history);
  }

  async withdraw(userId: string, applicationId: string): Promise<ApplicationResponse> {
    const application = await this.requireById(applicationId);
    if (application.candidate.userId !== userId) {
      throw new ForbiddenError('Это не ваш отклик');
    }
    if (!ApplicationStatusPolicy.canWithdraw(application.status)) {
      throw new ConflictError('Этот отклик уже нельзя отозвать');
    }

    const updated = await this.applications.updateStatus(
      applicationId,
      ApplicationStatus.WITHDRAWN,
      new Date(),
      { id: userId, role: Role.CANDIDATE },
      application.status,
    );

    await this.audit.record({
      action: 'APPLICATION_WITHDRAWN',
      entityType: 'Application',
      entityId: applicationId,
      actorId: userId,
      actorRole: Role.CANDIDATE,
      metadata: { vacancyId: application.vacancyId },
    });

    const history = await this.applications.findHistory(applicationId);
    return ApplicationPresenter.toResponse(updated, { history });
  }

  async decide(
    userId: string,
    applicationId: string,
    status: 'INVITED' | 'REJECTED',
  ): Promise<ApplicationResponse> {
    const application = await this.requireById(applicationId);
    if (application.vacancy.company.ownerId !== userId) {
      throw new ForbiddenError('Отклик относится к вакансии другой компании');
    }
    if (!ApplicationStatusPolicy.canBeDecided(application.status)) {
      throw new ConflictError('Решение по этому отклику уже принято');
    }

    const updated = await this.applications.updateStatus(
      applicationId,
      status,
      new Date(),
      { id: userId, role: Role.EMPLOYER },
      application.status,
    );

    await this.audit.record({
      action: status === ApplicationStatus.INVITED ? 'APPLICATION_INVITED' : 'APPLICATION_REJECTED',
      entityType: 'Application',
      entityId: applicationId,
      actorId: userId,
      actorRole: Role.EMPLOYER,
      metadata: { vacancyId: application.vacancyId },
    });

    const history = await this.applications.findHistory(applicationId);
    return ApplicationPresenter.toResponse(updated, {
      includeCandidate: true,
      match: this.matchCandidate(updated, updated.vacancy),
      history,
    });
  }

  private async requireById(applicationId: string) {
    const application = await this.applications.findById(applicationId);
    if (!application) {
      throw new NotFoundError('Отклик не найден');
    }
    return application;
  }

  private resolveAudience(
    application: ApplicationWithDetails,
    userId: string,
    role: Role,
  ): 'candidate' | 'employer' | 'admin' {
    if (application.candidate.userId === userId) {
      return 'candidate';
    }
    if (application.vacancy.company.ownerId === userId) {
      return 'employer';
    }
    if (role === Role.ADMIN) {
      return 'admin';
    }
    throw new ForbiddenError('Нет доступа к этому отклику');
  }

  private matchCandidate(
    application: ApplicationWithDetails,
    vacancy: Pick<VacancyEntity, 'schedule' | 'hourlyRateKopecks'>,
  ): VacancyMatch {
    return this.matcher.match(
      ScheduleMapper.toDomain(vacancy.schedule),
      ScheduleMapper.toDomain(application.candidate.availability),
      {
        hourlyRateKopecks: vacancy.hourlyRateKopecks,
        minHourlyRateKopecks: application.candidate.minHourlyRateKopecks,
      },
    );
  }
}
