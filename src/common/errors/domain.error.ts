/** Базовая ошибка предметной области. Слой HTTP не знает о конкретных подклассах. */
export abstract class DomainError extends Error {
  protected constructor(
    message: string,
    readonly code: string,
    readonly statusCode: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
    Error.captureStackTrace?.(this, new.target);
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'Требуется авторизация') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Недостаточно прав') {
    super(message, 'FORBIDDEN', 403);
  }
}

export class NotFoundError extends DomainError {
  constructor(message = 'Ресурс не найден') {
    super(message, 'NOT_FOUND', 404);
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(message, 'CONFLICT', 409, details);
  }
}

export class BusinessRuleError extends DomainError {
  constructor(message: string, code = 'BUSINESS_RULE_VIOLATION', details?: unknown) {
    super(message, code, 422, details);
  }
}
