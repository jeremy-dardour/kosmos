import request from 'supertest';

import { createTestApp } from '@/__e2e-tests__/helpers/create-app.helper';
import { MockTokenFactory } from '@/__e2e-tests__/helpers/mock-token.factory';
import { MockOidcService } from '@/__e2e-tests__/mocks/mock-oidc.service';

import type { INestApplication } from '@nestjs/common';
import type { Test as SuperTestType } from 'supertest';
import type TestAgent from 'supertest/lib/agent';

function createRequest(app: INestApplication): TestAgent<SuperTestType> {
  return request(app.getHttpServer() as never);
}

describe('Item CRUD E2E Tests', () => {
  const mockOidc = new MockOidcService();
  let tokenFactory: MockTokenFactory;
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    const clientId = process.env.AUTH_CLIENT_ID!;
    const audience = `api://${clientId}`;
    const acceptedScope = process.env.AUTH_ACCEPTED_SCOPES!;

    await mockOidc.setup();
    tokenFactory = new MockTokenFactory(mockOidc, audience, acceptedScope);
    token = await tokenFactory.validToken();

    app = await createTestApp({ oidcOverride: mockOidc });
  });

  afterAll(async () => {
    await app.close();
  });

  let createdItemId: string;

  describe('POST /items', () => {
    it('should create an item', async () => {
      const response = await createRequest(app)
        .post('/items')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Test Item', description: 'A test item' })
        .expect(201);

      expect(response.body).toMatchObject({
        name: 'Test Item',
        description: 'A test item',
      });
      const body = response.body as {
        id: string;
        createdAt: string;
        updatedAt: string;
      };
      expect(body.id).toBeDefined();
      expect(body.createdAt).toBeDefined();
      expect(body.updatedAt).toBeDefined();

      createdItemId = body.id;
    });

    it('should reject empty name', async () => {
      await createRequest(app)
        .post('/items')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '', description: 'No name' })
        .expect(422);
    });
  });

  describe('GET /items', () => {
    it('should return all items', async () => {
      const response = await createRequest(app)
        .get('/items')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const body = response.body as unknown[];
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /items/:id', () => {
    it('should return a single item', async () => {
      const response = await createRequest(app)
        .get(`/items/${createdItemId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: createdItemId,
        name: 'Test Item',
      });
    });

    it('should return 404 for non-existent item', async () => {
      await createRequest(app)
        .get('/items/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  describe('PATCH /items/:id', () => {
    it('should update an item', async () => {
      const response = await createRequest(app)
        .patch(`/items/${createdItemId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Item' })
        .expect(200);

      expect(response.body).toMatchObject({
        id: createdItemId,
        name: 'Updated Item',
        description: 'A test item',
      });
    });
  });

  describe('DELETE /items/:id', () => {
    it('should delete an item', async () => {
      await createRequest(app)
        .delete(`/items/${createdItemId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);
    });

    it('should return 404 after deletion', async () => {
      await createRequest(app)
        .get(`/items/${createdItemId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });
});
