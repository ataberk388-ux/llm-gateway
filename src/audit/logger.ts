import type { FastifyBaseLogger } from 'fastify';
import type { AuditRecord } from './types';

export class AuditLogger {
  constructor(private readonly log: FastifyBaseLogger) {}

  record(record: AuditRecord): void {
    // Structured pino log — never includes raw sensitive values, only counts
    this.log.info({ audit: true, ...record }, 'gateway.request');
  }
}
