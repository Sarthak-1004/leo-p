# Code quality remediation guide

Follow-up to the code review of 27 November 2026. Each step lists the problem found, the fix, and how to verify it. Steps run in order: step 1 makes every later diff readable.

| # | Area | Problem | Fix |
|---|------|---------|-----|
| 1 | Readability | Source files written as very long lines (up to 1,757 characters); no formatter | Prettier with one shared config, one-time reformat, format check in CI |
| 2 | Backend structure | All HTTP routes in one `app.ts`; loose `any` types at boundaries | Split routes into modules under `backend/src/routes/`; type request helpers |
| 3 | Security | Proxy IPs not trusted; `secure` cookie flag tied to `NODE_ENV`; CSP allows media from any `https:` origin and inline style elements | `TRUST_PROXY` setting; `secure` follows the HTTPS origin; `__Host-` session cookie on HTTPS; exact media origins; inline styles limited to attributes |
| 4 | Scalability | AI worker handles one job at a time inside the web process | `WORKER_CONCURRENCY` parallel leases; `WORKER_MODE` to run the worker as its own Cloud Run service |
| 5 | Database load | Every write request also writes a throttle row to PostgreSQL | Per-user action limit kept in memory; durable PostgreSQL limits stay for sign-in |
| 6 | Observability | Logs and a health check only; no request IDs, error reporting format, metrics or readiness | Request IDs, Google Cloud Error Reporting log format, `/api/health/ready` with queue state, token-protected `/api/metrics`, alert recipes |
| 7 | Frontend | Very large page components; `strict` not explicit; no unit tests | Explicit `strict`; split `admin/Mocks.tsx`; Vitest unit tests for shared logic |
| 8 | Testing | No coverage measurement; no frontend unit tests in CI | Coverage report in CI; Vitest in CI |
| 9 | Docs | Architecture and deployment docs must match the changes | Update ARCHITECTURE.md and docs/DEPLOYMENT.md |

## Step 1 - Formatting baseline

1. Add `prettier` to the root `package.json` with `.prettierrc.json` (print width 120) and `.prettierignore` (generated code, builds, content, archives, Markdown).
2. Add `npm run format` and `npm run format:check`.
3. Reformat once. This step must change no behaviour: typecheck, lint and all tests must pass unchanged afterwards.
4. Add `npm run format:check` to the CI workflow.

## Step 2 - Backend structure

1. Keep `buildApp` in `app.ts` for plugins, hooks and the error handler only.
2. Move route groups to `backend/src/routes/` (auth, student, attempts, results, content, admin, operations). Each exports `register(app, ctx)`.
3. Replace the `user(req:any)` helper with a typed version shared through the route context.
4. Verify: backend typecheck and the 83 API tests pass with no changes to the tests.

## Step 3 - Security hardening

1. `TRUST_PROXY`: unset (default) trusts nobody; set it to the hop count (for example `2` for Vercel then Cloud Run) or a CIDR list. Without it the per-IP limiter sees the proxy address.
2. Cookies: `secure` whenever `APP_ORIGIN` is HTTPS, not only when `NODE_ENV=production`. On HTTPS the session cookie is named `__Host-kanan_session`, which browsers only accept as secure, host-only and `path=/`. The old cookie name is still read once, so nobody is signed out by the deploy.
3. CSP: `media-src` and `img-src` list only `'self'`, `blob:`/`data:` and the exact storage origin (configured endpoint, or the derived AWS S3 bucket origin). Inline styles are allowed only as attributes (`style-src-attr`), and `<style>` elements must come from the site itself.
4. Not changed, by recorded client decision: no second sign-in factor for any role (28 October 2026 decision). Compensating controls already in place: password confirmation for sensitive staff writes, durable sign-in throttling, Admin security alerts, session revocation through `authVersion`. The retired `MFA_ENCRYPTION_KEY` stays in deployment config for rollback, as AGENTS.md requires.
5. Verify: security tests pass; a new test checks cookie flags and CSP.

## Step 4 - AI worker throughput

1. `WORKER_CONCURRENCY` (default 2, maximum 16): the number of jobs each process runs at once. Each slot claims its own lease with `FOR UPDATE SKIP LOCKED`, so slots and instances never take the same job.
2. `WORKER_MODE`: `inline` (default, current behaviour), `off` (web instances only), `only` (worker process without HTTP routes except health). Production can run a separate Cloud Run service `leo-prep-worker` with `WORKER_MODE=only` and CPU always allocated, and set `WORKER_MODE=off` on the API.
3. Verify: a test runs several jobs in parallel and checks that each completes exactly once.

## Step 5 - Database write load

1. The general per-user action limit (300 writes a minute) runs in memory per instance. It is an abuse backstop, not a security boundary. Sign-in, password and import limits stay durable in PostgreSQL.
2. Effect: an exam save is one fewer database write.
3. Remaining capacity work is infrastructure: size Cloud SQL to `db-custom-2-7680` for sittings above 100 students (see DEPLOYMENT.md).

## Step 6 - Observability

1. Every response carries `X-Request-Id`; logs include it.
2. Unhandled errors are logged with the stack trace and the fields Google Cloud Error Reporting groups on.
3. `/api/health` (liveness) stays cheap. `/api/health/ready` checks the database and reports whether the evaluation queue is stuck.
4. `/api/metrics` (Prometheus text format) returns request counts, latency buckets, 5xx counts, queue depth and worker state. It is disabled unless `METRICS_TOKEN` is set and requires `Authorization: Bearer <token>`.
5. DEPLOYMENT.md lists the Cloud Monitoring alerts to create: 5xx rate, p95 latency, database CPU, queue depth and failed jobs. Creating them needs the Google Cloud console and is an operator task.

## Step 7 - Frontend

1. Set `strict: true` explicitly in `tsconfig.app.json`.
2. Split `pages/admin/Mocks.tsx` into the page and its editor components.
3. Add Vitest with unit tests for shared utilities (band calculation, search, formatting).

## Step 8 - Testing

1. Backend coverage report: `npm --prefix backend run test:coverage` (Node's built-in coverage), run in CI.
2. Frontend unit tests: `npm --prefix frontend run test:unit`, run in CI.

## Step 9 - Documentation

Update ARCHITECTURE.md and docs/DEPLOYMENT.md with the new settings: `TRUST_PROXY`, `WORKER_MODE`, `WORKER_CONCURRENCY`, `METRICS_TOKEN`, the readiness endpoint and the alert list.

## Limits of code changes

Some ratings depend on operator actions outside the repository: database size, a separate worker service, and alert policies in Google Cloud. The code supports each one; the guide marks where an operator must act.
