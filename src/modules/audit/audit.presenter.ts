import { Prisma, Role } from '@prisma/client';
import { AuditLogEntry } from './audit.repository';

export interface AuditLogActor {
  id: string;
  email: string;
  role: Role;
}

export interface AuditLogResponse {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actor: AuditLogActor | null;
  actorRole: Role | null;
  metadata: Prisma.JsonValue | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export class AuditPresenter {
  static toResponse(entry: AuditLogEntry): AuditLogResponse {
    return {
      id: entry.id,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      actor: entry.actor,
      actorRole: entry.actorRole,
      metadata: entry.metadata,
      ip: entry.ip,
      userAgent: entry.userAgent,
      createdAt: entry.createdAt,
    };
  }
}
