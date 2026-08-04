import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { Controller, Get, Module, RequestMethod } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createStaticAssetsImports } from '@/app/config/static-assets.config';

import type { DynamicModule, INestApplication } from '@nestjs/common';

const indexHtml = '<!doctype html><title>spa</title>';

@Controller('projects')
class StubProjectController {
  @Get()
  list(): { ok: true } {
    return { ok: true };
  }
}

@Controller('health')
class StubHealthController {
  @Get()
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }
}

@Module({})
class StubAppModule {
  static forRoot(rootPath: string): DynamicModule {
    return {
      module: this,
      imports: createStaticAssetsImports(rootPath),
      controllers: [StubProjectController, StubHealthController],
    };
  }
}

describe('createStaticAssetsImports', () => {
  it('returns no imports when no root path is configured', () => {
    expect(createStaticAssetsImports(undefined)).toEqual([]);
    expect(createStaticAssetsImports('')).toEqual([]);
  });

  it('registers the static module when a root path is configured', () => {
    expect(createStaticAssetsImports('/srv/spa')).toHaveLength(1);
  });
});

describe('spa fallback routing', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const rootPath = await mkdtemp(path.join(tmpdir(), 'spa-dist-'));
    await writeFile(path.join(rootPath, 'index.html'), indexHtml);
    await mkdir(path.join(rootPath, 'assets'));
    await writeFile(path.join(rootPath, 'assets', 'app.js'), 'export {};');

    app = await NestFactory.create(StubAppModule.forRoot(rootPath), {
      logger: false,
    });
    app.setGlobalPrefix('api', {
      exclude: [{ path: 'health', method: RequestMethod.ALL }],
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(['/', '/anything', '/deep/spa/route'])(
    'serves index.html for %s',
    async (path) => {
      const response = await request(app.getHttpServer() as never).get(path);

      expect(response.status).toBe(200);
      expect(response.text).toContain('<title>spa</title>');
    },
  );

  it('serves static assets', async () => {
    const response = await request(app.getHttpServer() as never)
      .get('/assets/app.js')
      .expect(200);

    expect(response.text).toBe('export {};');
  });

  it('leaves API routes to their controllers', async () => {
    const projects = await request(app.getHttpServer() as never).get(
      '/api/projects',
    );
    const health = await request(app.getHttpServer() as never).get('/health');

    expect(projects.status).toBe(200);
    expect(projects.body).toEqual({ ok: true });
    expect(health.status).toBe(200);
    expect(health.body).toEqual({ status: 'ok' });
  });

  it.each(['/api/unknown', '/health/unknown', '/.well-known/unknown'])(
    'keeps %s a 404 instead of the SPA shell',
    async (path) => {
      const response = await request(app.getHttpServer() as never).get(path);

      expect(response.status).toBe(404);
      expect(response.text).not.toContain('<title>spa</title>');
    },
  );
});
