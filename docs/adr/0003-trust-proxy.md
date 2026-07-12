# ADR 0003: Express trust proxy is enabled

**Status:** Accepted — 2026-07

## Decision

`main.ts` sets `app.set('trust proxy', true)`, so Express honors
`X-Forwarded-For` / `X-Forwarded-Proto` from whatever sits in front of the
container.

## Why

The API builds absolute URLs from `request.protocol` + Host (the `Location`
header on 201 responses and pagination `Link` headers). Behind any
TLS-terminating proxy — ALB, nginx, Cloud Run, a PaaS router — those URLs
would say `http://` without trust proxy. It also makes `request.ip` (and
therefore the throttler's per-client buckets) use the real client IP instead
of the proxy's.

## Trade-off

`trust proxy: true` trusts the headers unconditionally. That is the right
default for the intended deployment (container behind a managed proxy). If a
fork exposes the API **directly** to the internet, clients can spoof
`X-Forwarded-For` and skew rate limiting — in that case narrow the setting to
your proxy's address range (e.g. `app.set('trust proxy', 'loopback')` or a
CIDR list) or remove it.
