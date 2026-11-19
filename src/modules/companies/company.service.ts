import { Injectable } from '@nestjs/common';
import { Company, CompanyStatus, Role } from '@prisma/client';
import { ConflictError, ForbiddenError, NotFoundError } from '../../common/errors/domain.error';
import { AuditService } from '../audit/audit.service';
import { CompanyPresenter, CompanyResponse } from '../users/users.presenter';
import { CompanyRepository } from './company.repository';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto';

@Injectable()
export class CompanyService {
  constructor(
    private readonly companies: CompanyRepository,
    private readonly audit: AuditService,
  ) {}

  async getMine(ownerId: string): Promise<CompanyResponse> {
    return CompanyPresenter.toResponse(await this.requireByOwner(ownerId));
  }

  async create(ownerId: string, dto: CreateCompanyDto): Promise<CompanyResponse> {
    if (await this.companies.findByOwnerId(ownerId)) {
      throw new ConflictError('У работодателя уже есть компания');
    }
    const company = await this.companies.create(ownerId, dto);
    await this.audit.record({
      action: 'COMPANY_CREATED',
      entityType: 'Company',
      entityId: company.id,
      actorId: ownerId,
      actorRole: Role.EMPLOYER,
      metadata: { name: company.name },
    });
    return CompanyPresenter.toResponse(company);
  }

  async update(ownerId: string, dto: UpdateCompanyDto): Promise<CompanyResponse> {
    const company = await this.requireByOwner(ownerId);
    const updated = await this.companies.update(company.id, dto);
    await this.audit.record({
      action: 'COMPANY_UPDATED',
      entityType: 'Company',
      entityId: company.id,
      actorId: ownerId,
      actorRole: Role.EMPLOYER,
      metadata: { fields: Object.keys(dto) },
    });
    return CompanyPresenter.toResponse(updated);
  }

  async requireByOwner(ownerId: string): Promise<Company> {
    const company = await this.companies.findByOwnerId(ownerId);
    if (!company) {
      throw new NotFoundError('Компания не найдена. Сначала заполните профиль компании');
    }
    return company;
  }

  async requireActiveByOwner(ownerId: string): Promise<Company> {
    const company = await this.requireByOwner(ownerId);
    if (company.status !== CompanyStatus.ACTIVE) {
      throw new ForbiddenError('Компания заблокирована');
    }
    return company;
  }
}
