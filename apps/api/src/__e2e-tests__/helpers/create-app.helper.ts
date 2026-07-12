import { Test } from '@nestjs/testing';

import { OidcDiscoveryService } from '@/app/auth/strategies/jwt/oidc-discovery.service';
import { createValidationPipe } from '@/app/config/validation.config';
import { AllExceptionsFilter } from '@/app/filters/all-exceptions.filter';
import { ProblemDetailsFilter } from '@/app/filters/problem-details.filter';
import { ThrottlerExceptionFilter } from '@/app/filters/throttler-exception.filter';
import { AppModule } from '@/app.module';

import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';

export async function createTestApp({
  oidcOverride,
}: {
  oidcOverride?: Partial<OidcDiscoveryService>;
}): Promise<INestApplication> {
  const testModuleBuilder = Test.createTestingModule({
    imports: [AppModule],
  });

  if (oidcOverride) {
    testModuleBuilder
      .overrideProvider(OidcDiscoveryService)
      .useValue(oidcOverride);
  }

  const moduleFixture: TestingModule = await testModuleBuilder.compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(
    app.get(ThrottlerExceptionFilter),
    app.get(ProblemDetailsFilter),
    app.get(AllExceptionsFilter),
  );
  await app.init();

  return app;
}
