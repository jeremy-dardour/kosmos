import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';

import { ProblemDetailsDto } from '@/shared/dtos/problem-details.dto';

import type { INestApplication } from '@nestjs/common';
import type { OpenAPIObject, SwaggerCustomOptions } from '@nestjs/swagger';

/**
 * Swagger base config
 */
export const swaggerConfig = {
  title: 'Template API',
  description: 'Fullstack template API',
  version: '1.0',
};

/**
 * Swagger UI custom options
 */
export const swaggerCustomOptions: SwaggerCustomOptions = {
  swaggerOptions: {
    persistAuthorization: true,
  },
};

/**
 * API version header config
 */
export const apiVersionConfig = {
  type: 'apiKey' as const,
  name: 'API-Version',
  in: 'header' as const,
  description: 'Optional API version header (e.g., 2024-11-01)',
};

/**
 * Add default error responses to all endpoints (RFC 9457 Problem Details)
 */
function addDefaultErrorResponses(document: OpenAPIObject): void {
  if (!document.paths) return;

  for (const path in document.paths) {
    const pathItem = document.paths[path];
    if (!pathItem) continue;

    for (const method of [
      'get',
      'post',
      'put',
      'patch',
      'delete',
      'options',
      'head',
    ] as const) {
      const operation = pathItem[method];
      // eslint-disable-next-line unicorn/no-break-in-nested-loop
      if (!operation || typeof operation !== 'object') continue;

      // Add default error response if not already defined
      if (!operation.responses?.default) {
        operation.responses ||= {};
        operation.responses.default = {
          description: 'Error response (400/401/403/404/422/429/500 etc.)',
          content: {
            'application/problem+json': {
              schema: { $ref: '#/components/schemas/ProblemDetailsDto' },
            },
          },
        };
      }
    }
  }
}

/**
 * Setup API documentation
 * - /docs - Scalar API docs (default)
 * - /swagger - Swagger UI (fallback)
 */
export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle(swaggerConfig.title)
    .setDescription(swaggerConfig.description)
    .setVersion(swaggerConfig.version)
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    .addServer('http://localhost:3000', 'Development')
    .addTag('health', 'Health check endpoints')
    .addBearerAuth()
    .addApiKey(apiVersionConfig)
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    include: [], // Add modules if you want to restrict scanning
    deepScanRoutes: true,
    extraModels: [ProblemDetailsDto],
    operationIdFactory: (controllerKey: string, methodKey: string) =>
      `${controllerKey}_${methodKey}`,
  });

  addDefaultErrorResponses(document);

  // Swagger UI (fallback)
  SwaggerModule.setup('api/swagger', app, document, {
    ...swaggerCustomOptions,
    yamlDocumentUrl: '/openapi.yaml',
  });

  // Scalar API reference
  app.use(
    '/api/docs',
    apiReference({
      content: document,
    }),
  );
}
