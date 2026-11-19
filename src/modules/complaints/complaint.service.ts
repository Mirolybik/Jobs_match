import { Injectable } from '@nestjs/common';
import { ComplaintStatus, VacancyStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { ForbiddenError, NotFoundError, ValidationError } from '../../common/errors/domain.error';
import { Page, toPage } from '../../common/dto/pagination.dto';
import { ApplicationRepository } from '../applications/application.repository';
import { VacancyRepository } from '../vacancies/vacancy.repository';
import { ComplaintRepository } from './complaint.repository';
import { ComplaintPresenter, ComplaintResponse } from './complaint.presenter';
import { ComplaintQueryDto, CreateComplaintDto, ResolveComplaintDto } from './dto/complaint.dto';

@Injectable()
export class ComplaintService {
  constructor(
    private readonly complaints: ComplaintRepository,
    private readonly vacancies: VacancyRepository,
    private readonly applications: ApplicationRepository,
    private readonly audit: AuditService,
  ) {}

  async create(userId: string, dto: CreateComplaintDto): Promise<ComplaintResponse> {
    if (Boolean(dto.vacancyId) === Boolean(dto.applicationId)) {
      throw new ValidationError('Укажите ровно одну цель жалобы: vacancyId или applicationId');
    }

    if (dto.vacancyId) {
      if (!(await this.vacancies.findById(dto.vacancyId))) {
        throw new NotFoundError('Вакансия не найдена');
      }
    }

    if (dto.applicationId) {
      const application = await this.applications.findById(dto.applicationId);
      if (!application) {
        throw new NotFoundError('Отклик не найден');
      }

      const isParticipant =
        application.candidate.userId === userId || application.vacancy.company.ownerId === userId;
      if (!isParticipant) {
        throw new ForbiddenError('Жалобу на отклик может подать только его участник');
      }
    }

    const complaint = await this.complaints.create({
      authorId: userId,
      vacancyId: dto.vacancyId,
      applicationId: dto.applicationId,
      reason: dto.reason.trim(),
      comment: dto.comment?.trim(),
    });

    await this.audit.record({
      action: 'COMPLAINT_CREATED',
      entityType: 'Complaint',
      entityId: complaint.id,
      actorId: userId,
      metadata: {
        vacancyId: dto.vacancyId ?? null,
        applicationId: dto.applicationId ?? null,
      },
    });

    return ComplaintPresenter.toResponse(complaint);
  }

  async list(query: ComplaintQueryDto): Promise<Page<ComplaintResponse>> {
    const { items, total } = await this.complaints.findAll(query.status, query.skip, query.limit);
    return toPage(items.map(ComplaintPresenter.toResponse), total, query);
  }

  async listMine(userId: string, query: ComplaintQueryDto): Promise<Page<ComplaintResponse>> {
    const { items, total } = await this.complaints.findByAuthor(
      userId,
      query.status,
      query.skip,
      query.limit,
    );
    return toPage(items.map(ComplaintPresenter.toResponse), total, query);
  }

  async getById(id: string): Promise<ComplaintResponse> {
    const complaint = await this.complaints.findById(id);
    if (!complaint) {
      throw new NotFoundError('Жалоба не найдена');
    }
    return ComplaintPresenter.toResponse(complaint);
  }

  async resolve(id: string, dto: ResolveComplaintDto): Promise<ComplaintResponse> {
    const complaint = await this.complaints.findById(id);
    if (!complaint) {
      throw new NotFoundError('Жалоба не найдена');
    }
    if (complaint.status !== ComplaintStatus.OPEN) {
      throw new ValidationError('Жалоба уже рассмотрена');
    }
    if (dto.removeVacancy && dto.status !== ComplaintStatus.RESOLVED) {
      throw new ValidationError('Снять вакансию можно только при подтверждении жалобы');
    }

    const updated = await this.complaints.updateStatus(
      id,
      dto.status,
      dto.resolutionComment?.trim(),
    );

    const vacancyId =
      dto.removeVacancy && dto.status === ComplaintStatus.RESOLVED
        ? (complaint.vacancyId ?? complaint.application?.vacancyId ?? null)
        : null;

    if (vacancyId) {
      await this.vacancies.updateStatus(vacancyId, VacancyStatus.REMOVED);
      await this.audit.record({
        action: 'VACANCY_REMOVED',
        entityType: 'Vacancy',
        entityId: vacancyId,
        metadata: { complaintId: id, reason: 'COMPLAINT_RESOLVED' },
      });
    }

    await this.audit.record({
      action: dto.status === ComplaintStatus.RESOLVED ? 'COMPLAINT_RESOLVED' : 'COMPLAINT_REJECTED',
      entityType: 'Complaint',
      entityId: id,
      metadata: {
        vacancyId: complaint.vacancyId,
        applicationId: complaint.applicationId,
        removeVacancy: Boolean(vacancyId),
      },
    });

    return ComplaintPresenter.toResponse(updated);
  }
}
