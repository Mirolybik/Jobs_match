import { Injectable } from '@nestjs/common';
import { ComplaintStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export const COMPLAINT_INCLUDE = {
  author: { select: { id: true, email: true, role: true } },
  vacancy: { select: { id: true, title: true, company: { select: { id: true, name: true } } } },
  application: {
    select: { id: true, status: true, vacancyId: true, candidateId: true },
  },
} satisfies Prisma.ComplaintInclude;

export type ComplaintWithRelations = Prisma.ComplaintGetPayload<{
  include: typeof COMPLAINT_INCLUDE;
}>;

@Injectable()
export class ComplaintRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(input: {
    authorId: string;
    vacancyId?: string;
    applicationId?: string;
    reason: string;
    comment?: string;
  }): Promise<ComplaintWithRelations> {
    return this.prisma.complaint.create({
      data: {
        authorId: input.authorId,
        vacancyId: input.vacancyId ?? null,
        applicationId: input.applicationId ?? null,
        reason: input.reason,
        comment: input.comment ?? null,
      },
      include: COMPLAINT_INCLUDE,
    });
  }

  findById(id: string): Promise<ComplaintWithRelations | null> {
    return this.prisma.complaint.findUnique({ where: { id }, include: COMPLAINT_INCLUDE });
  }

  async findAll(
    status: ComplaintStatus | undefined,
    skip: number,
    take: number,
  ): Promise<{ items: ComplaintWithRelations[]; total: number }> {
    const where: Prisma.ComplaintWhereInput = { status };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.complaint.findMany({
        where,
        include: COMPLAINT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.complaint.count({ where }),
    ]);

    return { items, total };
  }

  async findByAuthor(
    authorId: string,
    status: ComplaintStatus | undefined,
    skip: number,
    take: number,
  ): Promise<{ items: ComplaintWithRelations[]; total: number }> {
    const where: Prisma.ComplaintWhereInput = { authorId, status };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.complaint.findMany({
        where,
        include: COMPLAINT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.complaint.count({ where }),
    ]);

    return { items, total };
  }

  updateStatus(
    id: string,
    status: 'RESOLVED' | 'REJECTED',
    resolutionComment?: string,
  ): Promise<ComplaintWithRelations> {
    return this.prisma.complaint.update({
      where: { id },
      data: {
        status,
        resolutionComment: resolutionComment ?? null,
        resolvedAt: new Date(),
      },
      include: COMPLAINT_INCLUDE,
    });
  }
}
