import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import {
  RequestContext,
  runWithRequestContext,
} from '../request-context/request-context';

/**
 * Пишет структурированный журнал по каждому запросу и заводит
 * контекст с requestId. Заголовок X-Request-Id возвращается клиенту,
 * чтобы запрос можно было найти в логах по идентификатору.
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(request: Request, response: Response, next: NextFunction): void {
    const requestId = request.header('x-request-id')?.trim() || randomUUID();
    const startedAt = process.hrtime.bigint();

    const context: RequestContext = {
      requestId,
      ip: request.ip,
      userAgent: request.header('user-agent'),
    };

    response.setHeader('x-request-id', requestId);
    response.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const line = JSON.stringify({
        requestId,
        method: request.method,
        path: request.originalUrl,
        status: response.statusCode,
        durationMs: Math.round(durationMs * 10) / 10,
        userId: context.userId ?? null,
        ip: context.ip ?? null,
      });

      if (response.statusCode >= 500) {
        this.logger.error(line);
      } else if (response.statusCode >= 400) {
        this.logger.warn(line);
      } else {
        this.logger.log(line);
      }
    });

    runWithRequestContext(context, () => next());
  }
}
