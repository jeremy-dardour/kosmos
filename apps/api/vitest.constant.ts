export const VITEST_EXCLUDE_CONFIG = [
  // Test files
  '**/*.spec.ts',
  '**/*.e2e-spec.ts',
  '**/__e2e-tests__/**',
  '**/__tests__/**',
  // Barrel files
  '**/index.ts',
  '**/*.config.ts',
  // NestJS wiring — not unit-testable
  '**/*.module.ts',
  'src/main.ts',
  // Dtos
  'src/**/*.dto.ts',
  // App infrastructure — config, logger, swagger, filters, interceptors
  'src/app/config/**',
  'src/app/swagger/**',
  '**/*.decorator.ts',
  // Database — entities, migrations, seeders, factories, cli config
  'src/database/entities/**',
  'src/database/migrations/**',
  'src/database/seeders/**',
  'src/database/factories/**',
  // Commands entry points
  'src/commands/env.schema.ts',
  // Type-only files
  '**/*.type.ts',
  '**/*.types.ts',
  '**/*.interface.ts',
  '**/*.filter.ts',
  // Shared config schemas
  'src/shared/types/env.base.schema.ts',
];
export const VITEST_COVERAGE_PROVIDER = 'v8';
