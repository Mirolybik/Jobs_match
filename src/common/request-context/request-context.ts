import { Role } from '@prisma/client';
import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Контекст текущего HTTP-запроса. Хранится в AsyncLocalStorage, чтобы
 * журнал мог получить requestId, IP и пользователя без протаскивания
 * параметров через все слои приложения.
 */
export interface RequestContext {
  requestId: string;
  ip?: string;
  userAgent?: string;
  userId?: string;
  userRole?: Role;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(context: RequestContext, callback: () => T): T {
  return storage.run(context, callback);
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

export function bindRequestUser(userId: string, role: Role): void {
  const context = storage.getStore();
  if (context) {
    context.userId = userId;
    context.userRole = role;
  }
}
