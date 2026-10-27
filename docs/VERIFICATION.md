# Implementation verification - 27 October 2026

The connected project was verified locally on Windows with Node 24 and real PostgreSQL 18. The optional demo and live providers were tested separately; a backend/API failure does not fall back to fixtures.

| Check | Result |
| --- | --- |
| Backend TypeScript/build | Passed |
| Frontend TypeScript/production build | Passed |
| Frontend lint | Passed without warnings |
| PostgreSQL integration tests | 29 passed |
| Responsive/demo browser suite | 14 passed |
| Live API/browser suite | 8 passed |
| Local migration deployment | Seven migrations applied successfully |
| Backend production dependency audit | Zero reported vulnerabilities |
| Frontend dependency audit | Zero reported vulnerabilities after compatible dependency patches |
| Compiled production smoke | Passed: database health, SPA/JS delivery, anonymous API denial and CSP |
| Whitespace/diff check | Passed |

The 29 database tests cover roles, CSRF/origin, account expiry, course/owner isolation, Trainer contact exclusion, transactional attempt limits, durable answers/preferences, exact-payload idempotency and conflicting revisions, connected-time interruption flags, unreleased-score withholding, mandatory remarks, draft isolation, optimistic revisions, result release, offline Speaking notifications, credential revocation, CSV/XLSX validation, test-structure imports, expiry-reminder deduplication, immutable history, S3 entitlement/streaming and image-aware Writing request construction. They additionally cover closed-section recovery, task-specific module Writing timers/manual review, operational settings, public-field minimization, report filters/aggregation/export privacy, interruption review, course announcements, read-all ownership, scoped release, API restart recovery, explicit pending-work reassignment, account edits without password replacement and simultaneous claims/release with PostgreSQL conflict retries.

The live browser suite covers protected login/role routing, persistent account creation, real saved-answer recovery across reload, all nine theme/font combinations at 1440/1280/1024/768/430/390 px, saved preference restoration, Trainer privacy, manual evaluation and Admin release. It deliberately commits a save but drops its network acknowledgment, enters newer answers, retries, and verifies both answers survive reload. New scenarios exercise settings persistence, Admin announcements/notification visibility, report filtering/CSV download, operational/audit/media pages at all six widths, passage selection and submitted-section recovery, module-only review, existing builder saves and a deliberately delayed anonymous session response after successful sign-in.

The demo matrix covers the approved layouts plus management, builder, results, settings and profile pages at the six required widths. Live mobile assessment and media-management output were visually inspected. These checks are not a complete accessibility audit or cross-browser certification.

## Test harness correction

Repeated Windows test runs exposed a PostgreSQL 18 asynchronous I/O worker retaining shared memory after the external test runner stopped its parent. The verified orphan from the workspace's test cluster was removed without stopping the development database. Browser tests now use unique data directories, an available database port and synchronous I/O for the local test process. Production PostgreSQL configuration is not changed by this harness choice.

## Final implementation checks

All 51 automated cases passed (29 PostgreSQL integration, 14 demo/responsive and 8 live browser cases). Production builds and lint pass. Both dependency audits reported zero vulnerabilities. The seven migrations are applied to the local development database. The compiled application was checked against that database without creating any real accounts or assessment content; first owner-run setup remains required.

The release/concurrent-review check exposed raw row-lock serialization errors represented by Prisma P2010/adapter SQLSTATE metadata. The transaction helper now recognizes PostgreSQL serialization/deadlock codes as well as P2034, retries with bounded jitter, and reports an exhausted conflict as 409. Reports project only scoring fields inside PostgreSQL and discard paper/essay bodies rather than retaining full snapshots for every historical record.

Real assessment content/media is explicitly deferred by the user. Empty/draft catalogs are expected until later uploads. See IMPLEMENTATION_STATUS.md for the completed application scope and external launch boundaries.

## Verification limits

OpenAI and S3 adapters were tested against deterministic provider contracts/local test endpoints, not paid AI calls or an external storage account. Docker and GitHub CI definitions were prepared but not executed here. Hosting/TLS, complete licensed content and lower conversion rows, first production Admin credentials, real provider behavior, browser audio compatibility, production load/concurrency, backup/restore exercises and client UAT remain launch requirements.

No public deployment was performed. Original Stitch archives and the historical audit remain preserved. No real passwords, provider secrets or student records were committed.

## Subsequent content-task verification

The later content change passes 31 backend integration tests (the preceding 29 plus draft-pack validation and Admin-only/idempotent installation preserving staff edits and FLTs), all 14 responsive/demo browser tests at the six widths, frontend lint and both builds. The existing eight live workflow cases were not rerun for this content-only addition. A direct CSV round trip checked all 40 answer keys and multiline passages through the actual import parser. The local installation created 40 unpublished questions without populating or publishing the 80 FLT slots. Official-source links contain URLs/labels only; no official paper/audio was copied. Listening audio and pedagogical/difficulty calibration are not verified by these checks.


## Testing deployment preparation verification

The 27 October deployment preparation passes 31 PostgreSQL API integration cases, eight connected browser cases, all 14 responsive/demo cases and two deployment-routing cases (55 automated cases total). Both production builds, frontend lint and the generated Vercel package pass locally. The Vercel packaging check uses a synthetic HTTPS backend origin; it does not contact a hosting provider. Missing private-pack tooling was restored, and installation tests now use synthetic fixtures so the public checkout needs no private assessment sources.

Public repository exclusions were checked before publishing: .env/local credentials, PostgreSQL files, private content JSON/CSV/scripts, original Stitch archives and generated deployment output remain local. The checked-in .env.example contains placeholders only. API integration checks now assert no-store for anonymous and authenticated responses; routing checks confirm API paths never enter SPA fallback and proxy caching is disabled.

GitHub Actions runs checks on the published main branch, including an additional Linux container job that builds the actual Dockerfile, migrates/bootstraps an isolated PostgreSQL database and checks API health, anonymous API rejection and SPA navigation. Its credentials are synthetic CI fixtures. Read the current Actions result separately; local checks do not certify that remote job or a hosted deployment.
