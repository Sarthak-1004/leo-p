# Kanan IELTS Practice Portal

Student, Trainer and Admin portal following SOW-KANAN-IELTS-001 v1.0 (20 October 2026). The project now has a connected React frontend and a TypeScript/Fastify API with Prisma and real PostgreSQL.

## Start locally

Requires Node 24. Install the existing projects:

```powershell
npm ci --prefix backend
npm ci --prefix frontend
npm --prefix backend run db:generate
```

In a terminal, start development PostgreSQL (real persistent PostgreSQL, bound to loopback):

```powershell
npm run db:local
```

Keep that terminal open. In another terminal:

```powershell
npm run db:migrate
npm --prefix backend run setup
```

Setup asks for the initial Admin ID and a masked password. It creates only a secure password hash and 40 draft FLT slots per course. No demo students/results or ready-made tests are inserted. There is no default Admin password. The migrations were applied successfully to the local development database during implementation; first-Admin setup remains for the account owner to run.

Copy `backend/.env.example` to `backend/.env` and configure the server. The template's local DATABASE_URL matches the development runner. Keep real keys/passwords out of Git. Start the two application processes in separate terminals:

```powershell
npm run dev:api
npm run dev:web
```

Open the Vite URL (normally http://localhost:5173), then `/admin/login`. APP_ORIGIN must exactly match the browser origin; use localhost as configured, or change APP_ORIGIN when using 127.0.0.1. Students and Trainers use separate login pages and Admin-issued credentials.

A Docker PostgreSQL alternative is in compose.yaml. Supply POSTGRES_PASSWORD and update DATABASE_URL to match. Do not run it on the same port as the native development runner.

## Connected features

- Database-backed role sessions, scrypt passwords, CSRF/origin checks, login throttles and immediate account/access checks.
- Admin student/trainer creation, editing, credentials, contacts, access dates and assignment. Trainer projections exclude student contacts at the server.
- Question authoring, media upload adapter, practice selection, separate Practice Mock/FLT catalogs, test builder, conversion tables and course-level publication/availability controls.
- Transactional start limits (two Practice Mocks, one FLT), immutable snapshots, durable answers/display preferences, server-confirmed connected time and per-section balances, resume and safe repeated submission.
- Objective scoring, leased Writing AI jobs/retries, staff/manual evaluation, separate drafts, mandatory remarks and immutable score/audit history.
- Offline Speaking criteria/date, three-/four-skill recalculation, Admin single/selected release and recipient-scoped notifications.
- CSV/XLSX assignment, question and test-structure import with validation preview, confirmation, per-row errors and duplicate-confirmation protection.
- Dedicated academic reports with server filters, aggregates, pagination and CSV export; stored-record dashboards, workload and an optional course-separated leaderboard.
- Admin announcements, public support details, access/upload/evaluation/reminder settings, media library reuse and audited interruption reviews.
- Explicit pending-work reassignment, section submission/closed-section recovery, reading-passage navigation and module-only Writing review.

## Content deferral and launch configuration

S3-compatible storage and OpenAI Writing adapters are implemented but require real provider configuration. The optional example Writing model is configurable in backend/.env.example. No paid AI call, external S3 account or production deployment was performed. Manual evaluation is available while AI is unconfigured.

Real papers, questions, audio and images are deliberately deferred for your later upload. The media library and question/test CSV/XLSX imports are ready. Provide complete licensed questions, answer keys, audio, task images and full raw-to-band tables before publishing tests. The supplied SOW omits the lowest conversions; they are deliberately not invented. Practice Mock production counts await confirmation. Question/test-structure and assignment import, paginated list controls, additional record loading, session/throttle cleanup and deduplicated access-expiry reminders are implemented. Production monitoring/load/restore checks and client UAT remain launch work.

The default connected-time policy uses 3-second signals and a 7.5-second continuity window. Saved answers/time survive reload and are persisted in PostgreSQL; production network/server-outage and browser compatibility testing remain launch requirements. Do not describe local checks as a complete IELTS certification or production readiness audit.

## Demo mode

Live API mode is the default. For the original fixture review only, set VITE_DEMO_MODE=true before starting/building the frontend. The demo provider resets on reload and is never an API failure fallback. Role/course switches appear only in demo mode. Do not use it for real records.

## Checks

```powershell
npm --prefix backend run typecheck
npm --prefix frontend run typecheck
npm --prefix frontend run lint
npm run build
npm test
npm run test:e2e
npm --prefix frontend run test:live
```

Backend tests and live browser tests start isolated real PostgreSQL databases. Playwright requires installed Chromium. The demo suite checks six widths and all nine test theme/font combinations. The latest run passed 51 automated cases, production builds and lint, with zero reported dependency vulnerabilities. See [verification results](docs/VERIFICATION.md) for coverage and limitations; Docker/CI and external S3/AI calls have not been executed here.

## Documentation

| File | Purpose |
| --- | --- |
| [PRD.md](PRD.md) | Product scope, rules, acceptance and operational decisions. |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Backend/frontend boundaries, security and persistence. |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | Stitch visuals and responsive/UI standards. |
| [AGENTS.md](AGENTS.md) | Instructions for future implementation sessions. |
| [Admin guide](docs/ADMIN_GUIDE.md) | Account, content, evaluation and release operations. |
| [Trainer guide](docs/TRAINER_GUIDE.md) | Review, feedback and offline Speaking workflow. |
| [Deployment and operations](docs/DEPLOYMENT.md) | Configuration, build, hosting and launch gates. |
| [Implementation status](docs/IMPLEMENTATION_STATUS.md) | Application scope, deferred content and launch boundaries. |
| [Verification](docs/VERIFICATION.md) | Completed checks, evidence and verification limits. |
| [STITCH_AUDIT.md](STITCH_AUDIT.md) | Preserved historical design-source audit. |

Original Stitch archives remain unchanged in stitch-imports/. Never commit .env files, credentials, generated client/build output, local database files or test fixtures as production data.

## Original practice additions

The content task adds an explicit [40-question original draft pack](backend/content/README.md): 24 Reading, 8 Writing and 8 Listening questions with a recording script. It is labelled original practice, not official IELTS content. Install with `npm --prefix backend run content:practice` or import its CSV through Admin content import. Existing records are preserved; all additions are unpublished for review and the FLT catalog is unchanged. Listening requires an actual audio asset before publication.

Full official papers/audio have not been copied into the 80 FLT slots. The external resource links have been removed from the portal.


## Testing deployment

Target repository: [Sarthak-1004/leo-p](https://github.com/Sarthak-1004/leo-p). The checked-in configuration supports Vercel for the frontend and Render for the API/PostgreSQL service. Import the repository root on both providers; Vercel needs BACKEND_ORIGIN and Render needs the exact frontend APP_ORIGIN; render.yaml connects PostgreSQL and generates the first Admin password. Follow [the deployment sequence](docs/DEPLOYMENT.md#github-vercel-and-render-testing-deployment) for domains, first Admin setup and hosted verification. Account connections and provider provisioning remain required before a working testing URL exists.

Local assessment sources/answer keys, databases, passwords and original Stitch archives are intentionally excluded from the public repository. The application does not automatically import local questions or create demo users in hosting.

The selected Render configuration uses free plans for initial testing. The API sleeps after 15 idle minutes and its PostgreSQL database expires after 30 days. Background evaluation/reminder work stops while the API sleeps; use an approved paid configuration for continuous operation or longer-lived data.
