---
paths:
  - 'packages/api-contracts/**/*'
---

# Generated API contracts

`src/openapi.d.ts` is generated. When it conflicts during a merge or rebase,
resolve the conflict by regenerating it from the resulting API source with
`pnpm generate:api-types`; never choose either side or hand-edit the output.
