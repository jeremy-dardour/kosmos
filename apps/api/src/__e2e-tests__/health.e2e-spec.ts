import request from 'supertest';

import { createTestApp } from '@/__e2e-tests__/helpers/create-app.helper';

import type { HealthResponse } from '@/app/health/health.dto';
import type { INestApplication } from '@nestjs/common';
import type { Test as SuperTestType } from 'supertest';
import type TestAgent from 'supertest/lib/agent';

/**
 * Create type-safe supertest instance
 */
function createRequest(app: INestApplication): TestAgent<SuperTestType> {
  return request(app.getHttpServer() as never);
}

/**
 * Health E2E Tests
 *
 * Tests the health check endpoints for Kubernetes probes:
 * - /health - Full health check (database, memory, disk)
 * - /health/ready - Readiness probe (database only)
 * - /health/live - Liveness probe (memory only)
 */
describe('Health E2E Tests', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createTestApp({});
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /health/ready', () => {
    it('should return 200 when database is healthy', async () => {
      const response = await createRequest(app)
        .get('/health/ready')
        .expect(200);

      const health = response.body as HealthResponse;
      expect(health).toBeDefined();
    });

    it('should include database status in response', async () => {
      const response = await createRequest(app)
        .get('/health/ready')
        .expect(200);

      const health = response.body as HealthResponse;

      expect(health.database).toBeDefined();
      expect(health.database?.status).toBe('up');
    });
  });

  describe('GET /health/live', () => {
    it('should return 200 when memory is within limits', async () => {
      const response = await createRequest(app).get('/health/live').expect(200);

      const health = response.body as HealthResponse;
      expect(health).toBeDefined();
    });

    it('should include memory_heap status in response', async () => {
      const response = await createRequest(app).get('/health/live').expect(200);

      const health = response.body as HealthResponse;

      expect(health.memory_heap).toBeDefined();
      expect(health.memory_heap?.status).toBe('up');
    });
  });
});
