import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

import type {
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import type { Response } from 'express';
import type { Observable } from 'rxjs';

/**
 * Exposes the request-scoped tracing identifiers (stored in CLS by
 * cls.config.ts) as response headers:
 *
 * - X-Request-Id     — unique per request, for logging and debugging
 * - X-Correlation-Id — propagated across services for business transactions
 * - Trace-Id         — W3C Trace Context id (OpenTelemetry, Jaeger, Zipkin)
 */
@Injectable()
export class ContextHeadersInterceptor implements NestInterceptor {
  constructor(private readonly cls: ClsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const response = context.switchToHttp().getResponse<Response>();

    const requestId = this.cls.getId();
    if (requestId) {
      response.setHeader('X-Request-Id', requestId);
    }

    const correlationId = this.cls.get<string>('correlationId');
    if (correlationId) {
      response.setHeader('X-Correlation-Id', correlationId);
    }

    const traceId = this.cls.get<string>('traceId');
    if (traceId) {
      response.setHeader('Trace-Id', traceId);
    }

    return next.handle();
  }
}
