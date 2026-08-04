import { ServeStaticModule } from '@nestjs/serve-static';

import type { DynamicModule } from '@nestjs/common';

/**
 * Paths the API owns. A miss under one of them must fall through to the API's
 * RFC 9457 404 rather than be answered with the SPA shell. `health` and
 * `.well-known` sit outside the global `api` prefix (see `main.ts`), and
 * `/openapi.yaml` is served at the root by Swagger.
 */
const apiOwnedPaths = [
  '/api/{*path}',
  '/health/{*path}',
  '/.well-known/{*path}',
  '/openapi.yaml',
];

/**
 * Serves a built SPA with an index.html fallback, or nothing at all when no
 * root path is configured — leaving the API a pure JSON service.
 */
export function createStaticAssetsImports(
  rootPath: string | undefined,
): DynamicModule[] {
  if (!rootPath) {
    return [];
  }

  return [ServeStaticModule.forRoot({ rootPath, exclude: apiOwnedPaths })];
}
