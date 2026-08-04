---
paths:
  - 'apps/api/src/modules/**/*.controller.ts'
---

# API controllers

Adding, removing, or changing a route requires a matching tenancy e2e entry
in `src/__e2e-tests__/tenancy-enforcement.e2e-spec.ts` — either a `ROUTES`
row (non-member 404 + soft-deleted 404) or a justified `EXEMPT` entry. The
sweep's coverage meta-test fails otherwise; never fix that failure by
loosening the meta-test.
