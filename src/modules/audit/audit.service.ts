import { Injectable, Logger } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { Page, toPage } from '../../common/dto/pagination.dto';
import { getRequestContext } from '../../common/request-context/request-context';
import { AuditLogQueryDto } from './dto/audit-query.dto';
import { AuditPresenter, AuditLogResponse } from './audit.presenter';
import { AuditLogFilters, AuditRepository } from './audit.repository';

export interface RecordAuditInput {
  action: string;
  entityType: string;
  entityId?: string | null;
  actorId?: string | null;
  actorRole?: Role | null;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Журнал значимых действий. Ошибка записи не должна ломать бизнес-операцию,
 * поэтому она логируется и проглатывается.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly audit: AuditRepository) {}

  async record(input: RecordAuditInput): Promise<void> {
    const context = getRequestContext();

    try {
      await this.audit.create({
        ...input,
        actorId: input.actorId ?? context?.userId ?? null,
        actorRole: input.actorRole ?? context?.userRole ?? null,
        ip: context?.ip,
        userAgent: context?.userAgent,
      });
    } catch (error) {
      this.logger.error(
        `Не удалось записать действие ${input.action}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async list(query: AuditLogQueryDto): Promise<Page<AuditLogResponse>> {
    const filters: AuditLogFilters = {
      action: query.action?.trim(),
      entityType: query.entityType?.trim(),
      actorId: query.actorId,
      actorRole: query.actorRole,
      ...(query.from ? { from: new Date(query.from) } : {}),
      ...(query.to ? { to: new Date(query.to) } : {}),
    };

    const { items, total } = await this.audit.findMany(filters, query.skip, query.limit);

    return toPage(items.map(AuditPresenter.toResponse), total, query);
  }
}
