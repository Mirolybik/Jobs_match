import { Injectable } from '@nestjs/common';
import { ApplicationStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { IntervalSnapshot } from '../matching/domain/weekly-interval';

export const APPLICATION_DETAILS_INCLUDE = {
  vacancy: { include: { company: true, schedule: true } },
  candidate: { include: { availability: true, user: true } },
} satisfies Prisma.ApplicationInclude;

export const STATUS_EVENT_INCLUDE = {
  actor: { select: { id: true, email: true, role: true } },
} satisfies Prisma.ApplicationStatusEventInclude;

export type ApplicationWithDetails = Prisma.ApplicationGetPayload<{
  include: typeof APPLICATION_DETAILS_INCLUDE;
}>;

export type StatusEventWithActor = Prisma.ApplicationStatusEventGetPayload<{
  include: typeof STATUS_EVENT_INCLUDE;
}>;

export interface ApplicationActor {
  id: string;
  role: Role;
}

export interface CreateApplicationInput {
  vacancyId: string;
  candidateId: string;
  snapshotRateKopecks: number;
  snapshotCity: string;
  snapshotAddress: string;
  snapshotSchedule: IntervalSnapshot[];
  snapshotDeadlineHours: number;
  snapshotTakenAt: Date;
  deadlineAt: Date;
}

@Injectable()
export class ApplicationRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<ApplicationWithDetails | null> {
    return this.prisma.application.findUnique({
      where: { id },
      include: APPLICATION_DETAILS_INCLUDE,
    });
  }

  findByVacancyAndCandidate(vacancyId: string, candidateId: string) {
    return this.prisma.application.findUnique({
      where: { vacancyId_candidateId: { vacancyId, candidateId } },
    });
  }

  create(input: CreateApplicationInput, actor: ApplicationActor): Promise<ApplicationWithDetails> {
    return this.prisma.$transaction(async (transaction) => {
      const application = await transaction.application.create({
        data: {
          ...input,
          snapshotSchedule: input.snapshotSchedule as unknown as Prisma.InputJsonValue,
        },
        include: APPLICATION_DETAILS_INCLUDE,
      });

      await transaction.applicationStatusEvent.create({
        data: {
          applicationId: application.id,
          status: ApplicationStatus.PENDING,
          actorId: actor.id,
          actorRole: actor.role,
        },
      });

      return application;
    });
  }

  async findByCandidate(
    candidateId: string,
    skip: number,
    take: number,
  ): Promise<{ items: ApplicationWithDetails[]; total: number }> {
    const where: Prisma.ApplicationWhereInput = { candidateId };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.application.findMany({
        where,
        include: APPLICATION_DETAILS_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.application.count({ where }),
    ]);

    return { items, total };
  }

  async findByVacancy(
    vacancyId: string,
    skip: number,
    take: number,
  ): Promise<{ items: ApplicationWithDetails[]; total: number }> {
    const where: Prisma.ApplicationWhereInput = { vacancyId };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.application.findMany({
        where,
        include: APPLICATION_DETAILS_INCLUDE,
        orderBy: { createdAt: 'asc' },
        skip,
        take,
      }),
      this.prisma.application.count({ where }),
    ]);

    return { items, total };
  }

  findHistory(applicationId: string): Promise<StatusEventWithActor[]> {
    return this.prisma.applicationStatusEvent.findMany({
      where: { applicationId },
      include: STATUS_EVENT_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
  }

  updateStatus(
    id: string,
    status: 'INVITED' | 'REJECTED' | 'WITHDRAWN',
    decidedAt: Date,
    actor: ApplicationActor,
    previousStatus: ApplicationStatus,
    comment?: string,
  ): Promise<ApplicationWithDetails> {
    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.application.update({
        where: { id },
        data: { status, decidedAt },
        include: APPLICATION_DETAILS_INCLUDE,
      });

      await transaction.applicationStatusEvent.create({
        data: {
          applicationId: id,
          status,
          previousStatus,
          actorId: actor.id,
          actorRole: actor.role,
          comment: comment ?? null,
        },
      });

      return updated;
    });
  }
}
