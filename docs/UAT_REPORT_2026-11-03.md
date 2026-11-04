# Acceptance test report — 3 November 2026

Result: **automated local acceptance checks passed; institution acceptance and production launch approval remain pending.** No product defect was reproduced by this run. This is an engineering acceptance exercise against the existing PRD, not a claim of completed client UAT.

Tested application revision: `24238adbbc5af05ec5982e27276f0f93307b914d`. Windows, Node `v24.15.0`, local PostgreSQL and Playwright's default Chromium browser. The working tree was clean before testing. No application code was changed.

## Executed checks

| Check / command | Result |
| --- | --- |
| `npm test` | 55 backend cases passed; zero failed/skipped |
| `npm --prefix frontend run test:live` | 15 connected browser cases passed |
| `npm run test:e2e` | 18 separate preview cases passed |
| `node --test scripts/check-sarif.test.mjs scripts/build-vercel.test.mjs` | 12 tooling cases passed |
| `npm run build` | Backend and frontend production builds passed |
| `npm --prefix frontend run lint` | Passed |

Total: **100 automated cases passed**. Tooling cases are not user acceptance scenarios, and preview cases do not establish production persistence. No dependency/security scanner or remote CI job was rerun as part of this exercise.

The API suite created an isolated database with synthetic records. Connected browser tests started their own isolated PostgreSQL database and local API with demo mode disabled. Preview tests ran separately with demo mode explicitly enabled. Production accounts, records and provider services were not used.

## Acceptance coverage

| PRD scenario / workflow | Evidence and limits |
| --- | --- |
| Role login, ID/email and session persistence | Backend and connected browser pass for Student, Trainer and Admin; wrong-role/password/disabled accounts rejected; password-only staff confirmation exercised. |
| Course, publication and availability restrictions | Backend checks pass; preview verifies independent course availability. The production catalog was not inspected. |
| One FLT / two Practice Mock attempts; resume | Backend concurrent-start and attempt-limit cases pass; connected browser verifies resume and saved state. |
| Save/reload and interruption recovery | Backend gap/timer/idempotency/ownership cases pass. Connected browser loses a committed save acknowledgement, retries and verifies both answers after reload; section switching stays locked until acknowledged. |
| Unreleased results and Admin release | Backend withholds bootstrap/direct results; connected Student → Trainer → Admin flow passes and shows the released three-skill result with Speaking pending. |
| Offline Speaking and recalculation | Backend score/release/update checks and preview offline/recalculation checks pass. Connected Writing module review has no Speaking form. |
| Trainer privacy and academic access | Backend projections/reports/exports and connected bootstrap checks pass; assignment behavior is covered by API tests. |
| Remarks, revision conflicts and audit history | Backend mandatory remarks, draft isolation, optimistic edits, concurrency and immutable audit cases pass. |
| AI failure and incomplete evaluation | Local adapter/failure/manual-review checks pass; actual provider quality and live calls remain untested. |
| CSV/XLSX imports | Backend parsing, validation, repeat-confirmation and draft import cases pass. Client-supplied files still require acceptance testing. |
| Account/access enforcement | Backend expiry, disabled login, reset/revocation and role checks pass. This run does not certify every calendar boundary or mid-attempt account-change combination. |
| Listening speed restriction/reset | Preview controls pass. Actual audio playback and connected-mode speed behavior with institution media remain to be tested. |
| Responsive layout and display preferences | Six widths: 1440, 1280, 1024, 768, 430 and 390 px. Preview exercises all three themes and three font sizes across assessment sections; connected FLT checks all nine combinations and preference restoration. |
| Navigation, staff tools and reporting | Preview focus/mobile/collapsed-navigation checks pass; connected staff pages, settings save/reload, announcements, CSV export and builder save pass. |
| Exactly 40 FLTs per course | Not verified against the deployed database in this run; synthetic browser fixtures contain a limited catalog. |

Visual spot checks inspected generated desktop test-builder, mobile reports and mobile yellow/extra-large assessment screenshots. No obvious clipping was observed in those images. Automated width checks passed; this is not a full visual or accessibility audit. The assessment screenshot explicitly shows missing audio in its synthetic fixture, so it does not establish Listening playback readiness.

## Execution observations

- The first sandboxed backend invocation could not spawn child processes (`EPERM`); the approved execution with process access passed all 55 cases. This was an environment restriction, not an application assertion failure.
- Connected tests logged PostgreSQL serialization conflicts during evaluation. The existing bounded transaction retries recovered and the affected workflows passed. Production concurrency/load remains unmeasured.
- Browser runs were sequential to avoid sharing generated-output directories or test-server lifecycles.

Local logs are retained under `backend/.local/uat-2026-11-03/`: `backend.log`, `connected-browser.log`, `preview-browser.log`, `build.log`, `lint.log`, and `tooling.log`. Connected screenshots were preserved in `connected-screenshots/`; staff screenshots are under `tmp/design-audit/live/`. These generated artifacts remain ignored by Git.

## Remaining acceptance gates

1. Institution Admin and Trainer complete and sign off representative workflows using approved content and expected scoring, including both courses and client import files.
2. Validate the deployed catalog, complete licensed papers/audio/images and institution-approved conversion tables; confirm Practice Mock counts.
3. Exercise real private storage/audio playback, Writing provider quality, retries and cost controls using configured services.
4. Run authenticated staging/hosted workflows, real network interruption recovery and agreed concurrent-load scenarios. This run tested local development servers plus separate production builds, not the deployed environment or a built frontend served in production mode.
5. Check Edge, Firefox, Safari, real mobile devices/audio and assistive technology. Only default Chromium was exercised here.
6. Confirm cloud permissions, operational monitoring, backup retention and restoration of an actual production backup. Backup safety unit tests are not a production restore exercise.

Recommendation: proceed to institution-led staging UAT. Keep full student launch conditional on the remaining content, service and operational checks. No institution sign-off or new security rating is implied.
