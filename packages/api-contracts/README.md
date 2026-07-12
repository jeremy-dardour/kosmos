# @workspace/api-contracts

Auto-generated TypeScript types from the API's OpenAPI specification. This package is the **single source of truth** for all API types consumed by the frontend and other packages.

## How It Works

- Types are generated from the running API's `/openapi.yaml` endpoint using `openapi-typescript`
- The generated file lives at `src/openapi.d.ts`
- **Never edit `openapi.d.ts` manually** — always regenerate from OpenAPI

## Regenerating Types

From the **monorepo root** (requires the API to be running):

```bash
pnpm generate:api-types
```

This runs `openapi-typescript` against `http://localhost:3000/openapi.yaml` and outputs to `src/openapi.d.ts`.

## Scripts

- `pnpm format` — Format files with Prettier

## Usage

Import types in other workspace packages:

```ts
import type { paths, components } from '@workspace/api-contracts';
```

## Rules

- Types flow from **OpenAPI → this package → consumers**
- Backend DTO changes must trigger type regeneration
- Frontend must never manually duplicate backend types
