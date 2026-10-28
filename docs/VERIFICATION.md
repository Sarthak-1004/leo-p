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


## Design audit - 28 October 2026

Reviewed 47 routes against the existing Stitch/design-system baseline. An isolated preview sweep completed 282 route/width checks across 1440, 1280, 1024, 768, 430 and 390 px, with zero page-level horizontal overflows. Desktop/mobile screenshots were captured for all 47 routes; the other four widths were measured without extra screenshot copies. Connected-mode visual checks additionally cover reports, settings, imports, media, operations, audit, notifications and the live test builder at all six widths.

Production builds, TypeScript, lint and two deployment-routing tests pass. The connected browser suite passes all nine cases, including account/session persistence, saved assessments, Trainer evaluation/Admin release and the new six-width staff-page review. The preview suite adds four regression cases for mobile filtering/pagination/dialog focus, short-height collapsed navigation/tooltips, password visibility/input sizing and keeping large-font assessment navigation below the response. The original 17 cases and the added navigation case pass locally. The existing assessment matrix covers all nine theme/font combinations in Listening, Reading and Writing at every required width.

One overlapping initial browser run lost its local web server; a complete rerun and the final connected run passed. No application failure was reproduced in the sequential verification. Further checks are limited to the changed UI and any failures. Real local/hosted credentials and production student records were not used. The audit does not certify every browser, assistive technology or future client-supplied content. See DESIGN_REVIEW.md for page-level findings and corrections.

## Security remediation - 28 October 2026

The backend suite passes 45 cases: the original 31 API cases, seven API security regressions, five media validation cases and two password cases. The private audit harness separately passes 28 checks with the original six behavioral weakness probes now asserting secure outcomes. Its evidence and original assessment remain under ignored backend/.local/security-audit rather than the public repository.

Both builds, frontend lint without warnings and the two Vercel routing tests pass. The connected suite passes all ten cases, including section-transition input locking and retry/reload recovery, alongside the existing six-width staff checks and all nine assessment theme/font combinations. The final committed-transition/lost-response variant is additionally checked in isolation. Initial new-test failures concerned catalog labels/loading and Playwright assertions; the final full suite passed. An overlapping run also lost its local web server, so final verification ran with the prior servers fully stopped.

The updated backend dependency scan reports zero known npm advisories. A small local eight-request hash check completed at about 146 MB peak process RSS; this does not establish a 512 MB production container load limit. No updated hosting deployment, live credential change, real AI/storage call, cloud IAM review or backup restore was performed. Existing weak hashes upgrade on next successful login or Admin reset. The timer uses the documented server continuity window and cannot prove activity/disconnection inside it. Deployment smoke checks and operational assurance remain necessary.

## Staff MFA and operational hardening - 28 October 2026

The expanded backend suite passes 56 cases, including six MFA/recovery/step-up cases, the Admin-only privilege-readiness endpoint and three encrypted-backup safety cases. The private 28-check security harness passes with MFA-backed fixture sessions. Twelve connected browser cases pass, including authenticator enrollment, recovery acknowledgement and sensitive-action verification at 1440/1280/1024/768/430/390 px. The existing assessment display matrix remains covered. Ten SARIF-gate tests and the two deployment-routing checks validate the local scanner/routing gates. The additional transport regression confirms anonymous requests pass the limiter before authentication, forwarded headers cannot change its socket-source budget, and successful requests are counted once.

TypeScript, frontend lint and both builds pass. The updated dependency graph reports zero known npm advisories. The additive eighth migration was applied successfully to the loopback development database; real passwords and existing assessment records were preserved. Test records, keys, codes and private audit artifacts remain ignored. No real staff authenticator is enrolled by automation.

The first [Linux application/container run](https://github.com/Sarthak-1004/leo-p/actions/runs/40669457347) passed both jobs, including builds, backend/browser tests, startup within a 512 MB container, repeat bootstrap without credential replacement and an actual PostgreSQL 18 encrypted pg_dump/pg_restore round trip. Synthetic records, MFA ciphertext, immutable audit history and the populated-target guard survived restoration. This is recovery-tool verification, not a restored production backup.

The [follow-up security run](https://github.com/Sarthak-1004/leo-p/actions/runs/40686146926) passed dependencies, Git history secret scanning, CodeQL and the built-image gate. The initial image scan found six high advisories in global npm tooling; the Dockerfile now patches those bundled libraries, with the scan still enabled. Query-pack extension metadata is parsed correctly. One traced CodeQL password warning actually concerns a 256-bit random MFA cookie: it is reviewed with exact source/flow/hash checks and an expiry, not a broad query exclusion. Human passwords retain scrypt. The request-limiter regression also caught Fastify hook ordering; the limiter now executes before the global authentication hook and the full 56-case backend rerun passes.

Rollout confirmed for `aba34cf53f70fc017b4bc8c6b195a816bb41af3c`: [final application/container checks](https://github.com/Sarthak-1004/leo-p/actions/runs/40686563497) and [final security checks](https://github.com/Sarthak-1004/leo-p/actions/runs/40686563393) passed every job. This final application run passed 56 backend cases, 18 preview browser cases and 12 connected browser cases. Main-branch security checks passed as well. Vercel production serves the MFA client, and both direct Render and same-origin Vercel health responses report the exact rollout commit with no-store caching.

Eleven low-volume anonymous hosted checks passed: protected bootstrap/security routes reject anonymous access, encoded handler paths that reach the API remain protected, MFA verification requires a challenge and untrusted login origins are rejected. Vercel treats an encoded API prefix as a public SPA path; that response contains only the known public HTML shell, not API data. No production credentials, staff authenticator enrollment or student-record mutations were used. These checks do not replace authenticated production UAT or a penetration test.

Production IAM, off-site retention/recovery, edge controls, live provider testing and independent penetration testing remain separate verification items. Provider management connections were unavailable for those checks. See SECURITY_OPERATIONS.md for operational procedures and limitations.
