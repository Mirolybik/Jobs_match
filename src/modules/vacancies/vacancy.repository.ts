import { Injectable } from '@nestjs/common';
import { Prisma, VacancyStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ScheduleRecord } from '../matching/schedule.mapper';

export type VacancyEntity = Prisma.VacancyGetPayload<{
  include: { schedule: true; company: true };
}>;

export type VacancyEntityWithCount = Prisma.VacancyGetPayload<{
  include: {
    schedule: true;
    company: true;
    _count: { select: { applications: true } };
  };
}>;

export interface VacancyWriteInput {
  title: string;
  description: string;
  city: string;
  address: string;
  hourlyRateKopecks: number;
  responseDeadlineHours: number;
  schedule: ScheduleRecord[];
}

export interface PublishedVacancyFilters {
  city?: string;
  minHourlyRateKopecks?: number;
  search?: string;
  dayOfWeek?: number;
  fromMinute?: number;
  toMinute?: number;
  take?: number;
}

@Injectable()
export class VacancyRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<VacancyEntity | null> {
    return this.prisma.vacancy.findUnique({
      where: { id },
      include: { schedule: true, company: true },
    });
  }

  findPublished(filters: PublishedVacancyFilters): Promise<VacancyEntity[]> {
    return this.prisma.vacancy.findMany({
      where: {
        status: VacancyStatus.PUBLISHED,
        company: { status: 'ACTIVE' },
        ...(filters.city
          ? { city: { equals: filters.city, mode: Prisma.QueryMode.insensitive } }
          : {}),
        ...(filters.minHourlyRateKopecks !== undefined
          ? { hourlyRateKopecks: { gte: filters.minHourlyRateKopecks } }
          : {}),
        ...(filters.search
          ? {
              OR: [
                { title: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
                { description: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
                {
                  company: {
                    name: { contains: filters.search, mode: Prisma.QueryMode.insensitive },
                  },
                },
              ],
            }
          : {}),
        ...(filters.dayOfWeek
          ? {
              schedule: {
                some: {
                  dayOfWeek: filters.dayOfWeek,
                  ...(filters.fromMinute !== undefined && filters.toMinute !== undefined
                    ? {
                        startMinute: { lt: filters.toMinute },
                        endMinute: { gt: filters.fromMinute },
                      }
                    : {}),
                },
              },
            }
          : {}),
      },
      include: { schedule: true, company: true },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: filters.take ?? 500,
    });
  }

  async findByCompany(
    companyId: string,
    skip: number,
    take: number,
  ): Promise<{ items: VacancyEntityWithCount[]; total: number }> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.vacancy.findMany({
        where: { companyId },
        include: {
          schedule: true,
          company: true,
          _count: { select: { applications: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.vacancy.count({ where: { companyId } }),
    ]);

    return { items, total };
  }

  async findAllForAdmin(
    filters: { status?: VacancyStatus; city?: string },
    skip: number,
    take: number,
  ): Promise<{ items: VacancyEntityWithCount[]; total: number }> {
    const where: Prisma.VacancyWhereInput = {
      status: filters.status,
      ...(filters.city
        ? { city: { equals: filters.city, mode: Prisma.QueryMode.insensitive } }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.vacancy.findMany({
        where,
        include: {
          schedule: true,
          company: true,
          _count: { select: { applications: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.vacancy.count({ where }),
    ]);

    return { items, total };
  }

  create(companyId: string, input: VacancyWriteInput): Promise<VacancyEntity> {
    return this.prisma.vacancy.create({
      data: {
        companyId,
        title: input.title,
        description: input.description,
        city: input.city,
        address: input.address,
        hourlyRateKopecks: input.hourlyRateKopecks,
        responseDeadlineHours: input.responseDeadlineHours,
        schedule: { create: input.schedule },
      },
      include: { schedule: true, company: true },
    });
  }

  update(id: string, input: Partial<VacancyWriteInput>): Promise<VacancyEntity> {
    return this.prisma.$transaction(async (transaction) => {
      if (input.schedule) {
        await transaction.vacancyInterval.deleteMany({ where: { vacancyId: id } });
      }

      return transaction.vacancy.update({
        where: { id },
        data: {
          title: input.title,
          description: input.description,
          city: input.city,
          address: input.address,
          hourlyRateKopecks: input.hourlyRateKopecks,
          responseDeadlineHours: input.responseDeadlineHours,
          ...(input.schedule ? { schedule: { create: input.schedule } } : {}),
        },
        include: { schedule: true, company: true },
      });
    });
  }

  updateStatus(id: string, status: VacancyStatus): Promise<VacancyEntity> {
    return this.prisma.vacancy.update({
      where: { id },
      data: {
        status,
        ...(status === VacancyStatus.PUBLISHED ? { publishedAt: new Date() } : {}),
      },
      include: { schedule: true, company: true },
    });
  }
}
