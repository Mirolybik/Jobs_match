import { Injectable } from '@nestjs/common';
import { VacancyStatus } from '@prisma/client';
import { Page, toPage } from '../../common/dto/pagination.dto';
import { NotFoundError, ValidationError } from '../../common/errors/domain.error';
import { AuditService } from '../audit/audit.service';
import { ComplaintService } from '../complaints/complaint.service';
import { ComplaintResponse } from '../complaints/complaint.presenter';
import { ComplaintQueryDto, ResolveComplaintDto } from '../complaints/dto/complaint.dto';
import { AdminVacancyQueryDto } from '../vacancies/dto/vacancy.dto';
import { VacancyRepository } from '../vacancies/vacancy.repository';
import { VacancyPresenter, VacancyResponse } from '../vacancies/vacancy.presenter';
import {
  AdminCompanyQueryDto,
  AdminUserQueryDto,
  UpdateCompanyStatusDto,
  UpdateUserStatusDto,
} from './dto/admin.dto';
import { AdminRepository } from './admin.repository';
import {
  AdminCompanyResponse,
  AdminPresenter,
  AdminUserResponse,
} from './admin.presenter';

@Injectable()
export class AdminService {
  constructor(
    private readonly vacancies: VacancyRepository,
    private readonly complaints: ComplaintService,
    private readonly admin: AdminRepository,
    private readonly audit: AuditService,
  ) {}

  async listVacancies(query: AdminVacancyQueryDto): Promise<Page<VacancyResponse>> {
    const { items, total } = await this.vacancies.findAllForAdmin(
      { status: query.status, city: query.city?.trim() },
      query.skip,
      query.limit,
    );

    return toPage(
      items.map((vacancy) => VacancyPresenter.toResponse(vacancy)),
      total,
      query,
    );
  }

  async removeVacancy(id: string): Promise<VacancyResponse> {
    const vacancy = await this.vacancies.findById(id);
    if (!vacancy) {
      throw new NotFoundError('Вакансия не найдена');
    }
    if (vacancy.status === VacancyStatus.REMOVED) {
      return VacancyPresenter.toResponse(vacancy);
    }

    const removed = await this.vacancies.updateStatus(id, VacancyStatus.REMOVED);
    await this.audit.record({
      action: 'VACANCY_REMOVED',
      entityType: 'Vacancy',
      entityId: id,
      metadata: { reason: 'ADMIN_DECISION', title: vacancy.title },
    });

    return VacancyPresenter.toResponse(removed);
  }

  listComplaints(query: ComplaintQueryDto): Promise<Page<ComplaintResponse>> {
    return this.complaints.list(query);
  }

  getComplaint(id: string): Promise<ComplaintResponse> {
    return this.complaints.getById(id);
  }

  resolveComplaint(id: string, dto: ResolveComplaintDto): Promise<ComplaintResponse> {
    return this.complaints.resolve(id, dto);
  }

  async listUsers(query: AdminUserQueryDto): Promise<Page<AdminUserResponse>> {
    const { items, total } = await this.admin.findUsers(
      {
        role: query.role,
        status: query.status,
        search: query.search?.trim(),
      },
      query.skip,
      query.limit,
    );

    return toPage(items.map(AdminPresenter.toUserResponse), total, query);
  }

  async updateUserStatus(
    adminId: string,
    userId: string,
    dto: UpdateUserStatusDto,
  ): Promise<AdminUserResponse> {
    if (adminId === userId && dto.status === 'BLOCKED') {
      throw new ValidationError('Нельзя заблокировать собственный аккаунт');
    }

    const user = await this.admin.findUserById(userId);
    if (!user) {
      throw new NotFoundError('Пользователь не найден');
    }

    const updated = await this.admin.updateUserStatus(userId, dto.status);
    await this.audit.record({
      action: dto.status === 'BLOCKED' ? 'USER_BLOCKED' : 'USER_UNBLOCKED',
      entityType: 'User',
      entityId: userId,
      metadata: { previousStatus: user.status, email: user.email },
    });

    return AdminPresenter.toUserResponse(updated);
  }

  async listCompanies(query: AdminCompanyQueryDto): Promise<Page<AdminCompanyResponse>> {
    const { items, total } = await this.admin.findCompanies(
      {
        status: query.status,
        search: query.search?.trim(),
      },
      query.skip,
      query.limit,
    );

    return toPage(items.map(AdminPresenter.toCompanyResponse), total, query);
  }

  async updateCompanyStatus(
    companyId: string,
    dto: UpdateCompanyStatusDto,
  ): Promise<AdminCompanyResponse> {
    const company = await this.admin.findCompanyById(companyId);
    if (!company) {
      throw new NotFoundError('Компания не найдена');
    }

    const updated = await this.admin.updateCompanyStatus(companyId, dto.status);
    await this.audit.record({
      action: dto.status === 'SUSPENDED' ? 'COMPANY_SUSPENDED' : 'COMPANY_ACTIVATED',
      entityType: 'Company',
      entityId: companyId,
      metadata: { previousStatus: company.status, name: company.name },
    });

    return AdminPresenter.toCompanyResponse(updated);
  }
}
