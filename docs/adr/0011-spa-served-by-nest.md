# ADR 0011: Nest serves the production SPA

**Status:** Accepted — 2026-08

## Decision

The production image contains both the NestJS API and the Vite-built React
SPA. Nest serves the SPA through `ServeStaticModule` when `SERVE_STATIC_DIR`
is configured. Development leaves that variable unset and runs the web and
API processes separately.

The SPA fallback does not own `/api`, `/health`, `/.well-known`, or
`/openapi.yaml`. Misses under those paths continue through Nest and return the
API response, never `index.html`.

## Why

This is a low-traffic application with one production environment. One Cloud
Run service gives it one container, origin, domain, OAuth origin, and deploy
pipeline. It avoids production CORS configuration and deploys compatible web
and API versions atomically. A separate static host or CDN would improve edge
delivery but add another deployment target and configuration boundary without
a current performance need.

## Consequences

- Web and API availability, releases, and scaling are coupled.
- Static requests can experience a Cloud Run cold start and do not receive a
  dedicated CDN's edge delivery by default.
- The runtime image is larger because it contains the built SPA.
- Route exclusions are part of the API contract and require regression tests.
- The optional environment seam preserves separate Vite and Nest development
  workflows.

## When to revisit

Move the SPA to a static host or CDN when one or more of these becomes true:

- Cloud Run cold starts or asset latency become user-visible and edge caching
  would materially improve them.
- Static traffic becomes a meaningful share of Cloud Run cost or consumes
  capacity needed by API requests.
- Web and API need independent release cadences, rollback, or scaling.
- The application shell must remain available during an API outage.
- Multiple public domains or clients need the same assets at the edge.

At that point, deploy `apps/web/dist` to the static host, set its API base URL,
configure CORS and OAuth for the separate origins, and remove
`ServeStaticModule` plus `SERVE_STATIC_DIR` from the API image.
