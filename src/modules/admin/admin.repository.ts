import { Injectable } from '@nestjs/common';
import { CompanyStatus, Prisma, UserStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export const ADMIN_USER_INCLUDE = {
  candidateProfile: { select: { id: true, fullName: true, city: true } },
  company: { select: { id: true, name: true, city: true, status: true } },
} satisfies Prisma.UserInclude;

export const ADMIN_COMPANY_INCLUDE = {
  owner: { select: { id: true, email: true, status: true } },
  _count: { select: { vacancies: true } },
} satisfies Prisma.CompanyInclude;

export type AdminUserEntity = Prisma.UserGetPayload<{ include: typeof ADMIN_USER_INCLUDE }>;
export type AdminCompanyEntity = Prisma.CompanyGetPayload<{
  include: typeof ADMIN_COMPANY_INCLUDE;
}>;

export interface AdminUserFilters {
  role?: Prisma.UserWhereInput['role'];
  status?: UserStatus;
  search?: string;
}

export interface AdminCompanyFilters {
  status?: CompanyStatus;
  search?: string;
}

@Injectable()
export class AdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUsers(
    filters: AdminUserFilters,
    skip: number,
    take: number,
  ): Promise<{ items: AdminUserEntity[]; total: number }> {
    const where: Prisma.UserWhereInput = {
      ...(filters.role ? { role: filters.role } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.search
        ? {
            OR: [
              { email: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
              {
                candidateProfile: {
                  fullName: { contains: filters.search, mode: Prisma.QueryMode.insensitive },
                },
              },
              {
                company: {
                  name: { contains: filters.search, mode: Prisma.QueryMode.insensitive },
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: ADMIN_USER_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total };
  }

  findUserById(id: string): Promise<AdminUserEntity | null> {
    return this.prisma.user.findUnique({ where: { id }, include: ADMIN_USER_INCLUDE });
  }

  updateUserStatus(id: string, status: 'ACTIVE' | 'BLOCKED'): Promise<AdminUserEntity> {
    return this.prisma.$transaction(async (transaction) => {
      const user = await transaction.user.update({
        where: { id },
        data: { status },
        include: ADMIN_USER_INCLUDE,
      });

      if (status === UserStatus.BLOCKED) {
        await transaction.refreshToken.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      return user;
    });
  }

  async findCompanies(
    filters: AdminCompanyFilters,
    skip: number,
    take: number,
  ): Promise<{ items: AdminCompanyEntity[]; total: number }> {
    const where: Prisma.CompanyWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.search
        ? { name: { contains: filters.search, mode: Prisma.QueryMode.insensitive } }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.company.findMany({
        where,
        include: ADMIN_COMPANY_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.company.count({ where }),
    ]);

    return { items, total };
  }

  findCompanyById(id: string): Promise<AdminCompanyEntity | null> {
    return this.prisma.company.findUnique({ where: { id }, include: ADMIN_COMPANY_INCLUDE });
  }

  updateCompanyStatus(
    id: string,
    status: 'ACTIVE' | 'SUSPENDED',
  ): Promise<AdminCompanyEntity> {
    return this.prisma.company.update({
      where: { id },
      data: { status },
      include: ADMIN_COMPANY_INCLUDE,
    });
  }
}
