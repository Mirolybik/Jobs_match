import { Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export const AUDIT_LOG_INCLUDE = {
  actor: { select: { id: true, email: true, role: true } },
} satisfies Prisma.AuditLogInclude;

export type AuditLogEntry = Prisma.AuditLogGetPayload<{
  include: typeof AUDIT_LOG_INCLUDE;
}>;

export interface CreateAuditLogInput {
  action: string;
  entityType: string;
  entityId?: string | null;
  actorId?: string | null;
  actorRole?: Role | null;
  metadata?: Prisma.InputJsonValue;
  ip?: string | null;
  userAgent?: string | null;
}

export interface AuditLogFilters {
  action?: string;
  entityType?: string;
  actorId?: string;
  actorRole?: Role;
  from?: Date;
  to?: Date;
}

@Injectable()
export class AuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateAuditLogInput): Promise<AuditLogEntry> {
    return this.prisma.auditLog.create({
      data: {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        actorId: input.actorId ?? null,
        actorRole: input.actorRole ?? null,
        metadata: input.metadata,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
      include: AUDIT_LOG_INCLUDE,
    });
  }

  async findMany(
    filters: AuditLogFilters,
    skip: number,
    take: number,
  ): Promise<{ items: AuditLogEntry[]; total: number }> {
    const where: Prisma.AuditLogWhereInput = {
      ...(filters.action ? { action: filters.action } : {}),
      ...(filters.entityType ? { entityType: filters.entityType } : {}),
      ...(filters.actorId ? { actorId: filters.actorId } : {}),
      ...(filters.actorRole ? { actorRole: filters.actorRole } : {}),
      ...(filters.from || filters.to
        ? {
            createdAt: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: AUDIT_LOG_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total };
  }
}
