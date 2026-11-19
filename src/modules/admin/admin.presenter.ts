import { CompanyStatus, Role, UserStatus } from '@prisma/client';
import { AdminCompanyEntity, AdminUserEntity } from './admin.repository';

export interface AdminUserResponse {
  id: string;
  email: string;
  role: Role;
  status: UserStatus;
  createdAt: Date;
  candidateProfile: { id: string; fullName: string; city: string } | null;
  company: { id: string; name: string; city: string; status: CompanyStatus } | null;
}

export interface AdminCompanyResponse {
  id: string;
  name: string;
  city: string;
  address: string;
  description: string | null;
  status: CompanyStatus;
  createdAt: Date;
  owner: { id: string; email: string; status: UserStatus };
  vacancyCount: number;
}

export class AdminPresenter {
  static toUserResponse(user: AdminUserEntity): AdminUserResponse {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      candidateProfile: user.candidateProfile,
      company: user.company,
    };
  }

  static toCompanyResponse(company: AdminCompanyEntity): AdminCompanyResponse {
    return {
      id: company.id,
      name: company.name,
      city: company.city,
      address: company.address,
      description: company.description,
      status: company.status,
      createdAt: company.createdAt,
      owner: company.owner,
      vacancyCount: company._count.vacancies,
    };
  }
}
