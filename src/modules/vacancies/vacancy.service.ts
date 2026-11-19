import { Injectable } from '@nestjs/common';
import { Role, VacancyStatus } from '@prisma/client';
import {
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../common/errors/domain.error';
import { Page, toPage } from '../../common/dto/pagination.dto';
import { rublesToKopecks } from '../../common/utils/money';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { AuditService } from '../audit/audit.service';
import { CandidateService } from '../candidates/candidate.service';
import { CompanyService } from '../companies/company.service';
import { DayOfWeek } from '../matching/domain/day-of-week';
import { TimeOfDay } from '../matching/domain/time-of-day';
import { WeeklyInterval } from '../matching/domain/weekly-interval';
import { WeeklySchedule } from '../matching/domain/weekly-schedule';
import { VacancyMatch } from '../matching/domain/vacancy-match';
import { ScheduleMapper } from '../matching/schedule.mapper';
import { ScheduleMatcher } from '../matching/schedule-matcher.service';
import { CreateVacancyDto, UpdateVacancyDto, VacancyQueryDto } from './dto/vacancy.dto';
import { VacancyEntity, VacancyRepository, VacancyWriteInput } from './vacancy.repository';
import { VacancyPresenter, VacancyResponse } from './vacancy.presenter';

interface VacancyView {
  vacancy: VacancyEntity;
  match?: VacancyMatch;
}

@Injectable()
export class VacancyService {
  constructor(
    private readonly vacancies: VacancyRepository,
    private readonly companies: CompanyService,
    private readonly candidates: CandidateService,
    private readonly matcher: ScheduleMatcher,
    private readonly audit: AuditService,
  ) {}

  async list(query: VacancyQueryDto, viewer?: AuthenticatedUser): Promise<Page<VacancyResponse>> {
    if (query.onlyMatching && viewer?.role !== Role.CANDIDATE) {
      throw new ForbiddenError('Фильтр onlyMatching доступен только соискателям');
    }

    const filters = this.toPublishedFilters(query);
    const published = await this.vacancies.findPublished(filters);

    const candidateSchedule =
      viewer?.role === Role.CANDIDATE ? await this.candidateSchedule(viewer.id) : null;

    let views: VacancyView[] = published.map((vacancy) => ({
      vacancy,
      ...(candidateSchedule
        ? {
            match: this.matcher.match(
              ScheduleMapper.toDomain(vacancy.schedule),
              candidateSchedule.schedule,
              {
                hourlyRateKopecks: vacancy.hourlyRateKopecks,
                minHourlyRateKopecks: candidateSchedule.minHourlyRateKopecks,
              },
            ),
          }
        : {}),
    }));

    if (query.onlyMatching) {
      views = views.filter((view) => view.match?.matched === true);
    }

    const pageItems = views.slice(query.skip, query.skip + query.limit);
    return toPage(
      pageItems.map((view) => VacancyPresenter.toResponse(view.vacancy, view.match)),
      views.length,
      query,
    );
  }

  async getById(id: string, viewer?: AuthenticatedUser): Promise<VacancyResponse> {
    const vacancy = await this.vacancies.findById(id);
    if (!vacancy) {
      throw new NotFoundError('Вакансия не найдена');
    }

    const privileged = this.isOwnerOrAdmin(vacancy, viewer);
    if (vacancy.status !== VacancyStatus.PUBLISHED && !privileged) {
      throw new NotFoundError('Вакансия не найдена');
    }
    if (vacancy.company.status !== 'ACTIVE' && !privileged) {
      throw new NotFoundError('Вакансия не найдена');
    }

    const match =
      viewer?.role === Role.CANDIDATE ? await this.matchForVacancy(vacancy, viewer.id) : undefined;

    return VacancyPresenter.toResponse(vacancy, match);
  }

  async getMine(userId: string, query: VacancyQueryDto): Promise<Page<VacancyResponse>> {
    const company = await this.companies.requireByOwner(userId);
    const { items, total } = await this.vacancies.findByCompany(
      company.id,
      query.skip,
      query.limit,
    );

    return toPage(
      items.map((vacancy) => VacancyPresenter.toResponse(vacancy)),
      total,
      query,
    );
  }

  async matchForCandidate(vacancyId: string, userId: string) {
    const vacancy = await this.requirePublished(vacancyId);
    const match = await this.matchForVacancy(vacancy, userId);
    return { vacancyId, ...match.toJSON() };
  }

  async create(userId: string, dto: CreateVacancyDto): Promise<VacancyResponse> {
    const company = await this.companies.requireActiveByOwner(userId);
    const vacancy = await this.vacancies.create(company.id, this.toWriteInput(dto));

    await this.audit.record({
      action: 'VACANCY_CREATED',
      entityType: 'Vacancy',
      entityId: vacancy.id,
      actorId: userId,
      actorRole: Role.EMPLOYER,
      metadata: { companyId: company.id, title: vacancy.title },
    });

    return VacancyPresenter.toResponse(vacancy);
  }

  async update(userId: string, vacancyId: string, dto: UpdateVacancyDto): Promise<VacancyResponse> {
    const vacancy = await this.requireOwned(vacancyId, userId);
    if (vacancy.status === VacancyStatus.REMOVED) {
      throw new ConflictError('Снятую вакансию нельзя редактировать');
    }
    if (vacancy.status === VacancyStatus.CLOSED) {
      throw new ConflictError('Закрытую вакансию нельзя редактировать');
    }

    const updated = await this.vacancies.update(vacancyId, this.toUpdateInput(dto));

    await this.audit.record({
      action: 'VACANCY_UPDATED',
      entityType: 'Vacancy',
      entityId: vacancyId,
      actorId: userId,
      actorRole: Role.EMPLOYER,
      metadata: { fields: Object.keys(dto) },
    });

    return VacancyPresenter.toResponse(updated);
  }

  async publish(userId: string, vacancyId: string): Promise<VacancyResponse> {
    const vacancy = await this.requireOwned(vacancyId, userId);
    await this.companies.requireActiveByOwner(userId);

    if (vacancy.status === VacancyStatus.PUBLISHED) {
      return VacancyPresenter.toResponse(vacancy);
    }
    if (vacancy.status === VacancyStatus.REMOVED || vacancy.status === VacancyStatus.CLOSED) {
      throw new ConflictError('Эту вакансию нельзя опубликовать повторно');
    }
    if (vacancy.schedule.length === 0) {
      throw new BusinessRuleError('Нельзя опубликовать вакансию без рабочих часов');
    }

    const published = await this.vacancies.updateStatus(vacancyId, VacancyStatus.PUBLISHED);

    await this.audit.record({
      action: 'VACANCY_PUBLISHED',
      entityType: 'Vacancy',
      entityId: vacancyId,
      actorId: userId,
      actorRole: Role.EMPLOYER,
      metadata: { title: vacancy.title },
    });

    return VacancyPresenter.toResponse(published);
  }

  async close(userId: string, vacancyId: string): Promise<VacancyResponse> {
    const vacancy = await this.requireOwned(vacancyId, userId);

    if (vacancy.status === VacancyStatus.CLOSED) {
      return VacancyPresenter.toResponse(vacancy);
    }
    if (vacancy.status === VacancyStatus.REMOVED) {
      throw new ConflictError('Снятую вакансию нельзя закрыть');
    }

    const closed = await this.vacancies.updateStatus(vacancyId, VacancyStatus.CLOSED);

    await this.audit.record({
      action: 'VACANCY_CLOSED',
      entityType: 'Vacancy',
      entityId: vacancyId,
      actorId: userId,
      actorRole: Role.EMPLOYER,
      metadata: { title: vacancy.title },
    });

    return VacancyPresenter.toResponse(closed);
  }

  /** Проверка владения — используется модулем откликов. */
  async requireOwned(vacancyId: string, userId: string): Promise<VacancyEntity> {
    const vacancy = await this.vacancies.findById(vacancyId);
    if (!vacancy) {
      throw new NotFoundError('Вакансия не найдена');
    }
    if (vacancy.company.ownerId !== userId) {
      throw new ForbiddenError('Вакансия принадлежит другой компании');
    }
    return vacancy;
  }

  async requirePublished(vacancyId: string): Promise<VacancyEntity> {
    const vacancy = await this.vacancies.findById(vacancyId);
    if (
      !vacancy ||
      vacancy.status !== VacancyStatus.PUBLISHED ||
      vacancy.company.status !== 'ACTIVE'
    ) {
      throw new NotFoundError('Опубликованная вакансия не найдена');
    }
    return vacancy;
  }

  private async matchForVacancy(vacancy: VacancyEntity, userId: string): Promise<VacancyMatch> {
    const candidate = await this.candidateSchedule(userId);
    return this.matcher.match(ScheduleMapper.toDomain(vacancy.schedule), candidate.schedule, {
      hourlyRateKopecks: vacancy.hourlyRateKopecks,
      minHourlyRateKopecks: candidate.minHourlyRateKopecks,
    });
  }

  private async candidateSchedule(userId: string): Promise<{
    schedule: WeeklySchedule;
    minHourlyRateKopecks: number | null;
  }> {
    const profile = await this.candidates.requireProfile(userId);
    return {
      schedule: ScheduleMapper.toDomain(profile.availability),
      minHourlyRateKopecks: profile.minHourlyRateKopecks,
    };
  }

  private isOwnerOrAdmin(vacancy: VacancyEntity, viewer?: AuthenticatedUser): boolean {
    if (!viewer) {
      return false;
    }
    return (
      viewer.role === Role.ADMIN ||
      (viewer.role === Role.EMPLOYER && vacancy.company.ownerId === viewer.id)
    );
  }

  private toPublishedFilters(query: VacancyQueryDto) {
    if ((query.from && !query.to) || (!query.from && query.to)) {
      throw new ValidationError('Параметры from и to указываются вместе');
    }
    if (query.from && !query.dayOfWeek) {
      throw new ValidationError('Для фильтра по времени укажите dayOfWeek');
    }

    return {
      ...(query.city ? { city: query.city.trim() } : {}),
      ...(query.minHourlyRate !== undefined
        ? { minHourlyRateKopecks: rublesToKopecks(query.minHourlyRate) }
        : {}),
      ...(query.search ? { search: query.search.trim() } : {}),
      ...(query.dayOfWeek ? { dayOfWeek: query.dayOfWeek } : {}),
      ...(query.from ? { fromMinute: TimeOfDay.parse(query.from).minutes } : {}),
      ...(query.to ? { toMinute: TimeOfDay.parse(query.to).minutes } : {}),
    };
  }

  private toWriteInput(dto: CreateVacancyDto): VacancyWriteInput {
    return {
      title: dto.title.trim(),
      description: dto.description.trim(),
      city: dto.city.trim(),
      address: dto.address.trim(),
      hourlyRateKopecks: rublesToKopecks(dto.hourlyRate),
      responseDeadlineHours: dto.responseDeadlineHours ?? 72,
      schedule: ScheduleMapper.toPersistence(this.buildSchedule(dto.schedule)),
    };
  }

  private toUpdateInput(dto: UpdateVacancyDto): Partial<VacancyWriteInput> {
    return {
      title: dto.title?.trim(),
      description: dto.description?.trim(),
      city: dto.city?.trim(),
      address: dto.address?.trim(),
      hourlyRateKopecks: dto.hourlyRate === undefined ? undefined : rublesToKopecks(dto.hourlyRate),
      responseDeadlineHours: dto.responseDeadlineHours,
      ...(dto.schedule
        ? { schedule: ScheduleMapper.toPersistence(this.buildSchedule(dto.schedule)) }
        : {}),
    };
  }

  private buildSchedule(
    slots: { dayOfWeek: number; start: string; end: string }[],
  ): WeeklySchedule {
    const schedule = WeeklySchedule.fromIntervals(
      slots.map((slot) =>
        WeeklyInterval.fromTimes(
          slot.dayOfWeek as DayOfWeek,
          TimeOfDay.parse(slot.start),
          TimeOfDay.parse(slot.end),
        ),
      ),
    );

    if (schedule.isEmpty) {
      throw new BusinessRuleError('Нужно указать хотя бы один рабочий интервал');
    }

    return schedule;
  }
}
