# Architecture - Connected IELTS Portal

## Current state

Updated 27 October 2026 for SOW-KANAN-IELTS-001 v1.0 (20 October 2026). The subsequent authorized full-project task implements the existing frontend with a TypeScript API and real PostgreSQL. Hosting, external service credentials and go-live validation remain pending.

The initial Stitch audit remains a historical record in STITCH_AUDIT.md: its source archives were standalone HTML/CSS/JavaScript/Tailwind CDN documents. A React application now exists, so the audit's statements about absent application tooling and pending implementation are no longer the current repository status. The current PRD supersedes its old product-scope assumptions, especially digital Speaking, Trainer authority, assessment types, scoring, and release.

| Layer | Current repository |
| --- | --- |
| Frontend | React with TypeScript, Vite, React Router, Tailwind CSS and shared CSS tokens. Exact versions/scripts are in `frontend/package.json`. |
| Structure | `src/app`, `components`, `layouts`, `pages`, `routes`, `types`, `mocks`, `services`, `styles`, `assets`, and `utils`. |
| Data | Live API mode uses Prisma/PostgreSQL. Explicit VITE_DEMO_MODE=true selects the independent fixture provider; it never serves as an API fallback. |
| Identity | Database-backed, hashed-token HttpOnly sessions, CSRF/origin checks, bounded scrypt hashing, mandatory staff MFA and recent password/MFA proof for sensitive writes. Role/course switches exist only in demo mode. |
| Attempts/evaluation | Transactional PostgreSQL starts/submissions, per-section connected-time saves, immutable snapshots, optimistic evaluation revisions, offline Speaking, release, notifications and append-only audit history. |
| API/database | Node 24, Fastify 5, TypeScript, Prisma 7.10.1 with the pg adapter, versioned PostgreSQL migrations and integration tests against a real local PostgreSQL process. |
| External services | S3-compatible upload/authorized media streaming, durable Writing AI jobs via OpenAI Responses and server CSV/XLSX import are implemented. External credentials/live-service tests and production deployment are still required. |

A successful frontend build does not validate server authorization, durable recovery, AI quality, or production readiness. Do not enter real student data or credentials into the preview.

## Frontend boundaries

Retain the existing scaffold and Stitch-derived components. Student, Trainer and Admin use role-specific navigation in shared responsive shells. Exam layouts isolate test display preferences. Use one responsive route per page, not separate mobile routes.

```text
frontend/src/
  app/          live/demo providers and domain workflow mutations
  components/   reusable controls and assessment presentation
  layouts/      portal and assessment shells
  pages/        student, trainer, admin and utility views
  routes/       route registration
  types/        domain and view contracts
  mocks/        clearly identified sample data
  services/     same-origin API client and isolated demo adapters
  utils/        formatting and pure calculation helpers
  styles/       Stitch-derived design tokens and responsive styles
  assets/       bundled fonts/assets
```

Pages consume domain contracts rather than importing production secrets or assuming fixture availability equals permission. Keep Student, Trainer and Admin API response shapes separate. A client-side route guard remains a usability aid, never a security boundary. Do not expose the existing all-data fixture adapter in production.

Retain course-qualified test identifiers; distinguish `Practice`, `Practice Mock Test`, and `Full Length Test` in domain logic, history, catalogs and release. A legacy internal `mock` filename/route may remain for compatibility, but labels and rules must distinguish the two full-test types. Exactly 40 FLTs exist per course; sample Practice Mock fixtures do not settle the unconfirmed production count.

Do not implement browser microphone capture, Speaking submissions, transcripts or Speaking AI. Speaking question content remains staff/offline material. Trainer grade entry is distinct from an online student assessment section.

## Application flow

```text
Student / Trainer / Admin frontend
              |
       Authenticated backend API
              |
    Authorization + application services
              |
       Prisma ORM
              |
        Real PostgreSQL

Application services --> Protected object storage (Listening audio, task images)
Application services --> Writing evaluation job worker --> AI provider
Application services --> In-app notification + audit records
```

These are domain boundaries, not a requirement for microservices or separate deployments. Use a maintainable backend suited to hundreds of active students. The implementation uses one Fastify API process, PostgreSQL-backed sessions/jobs, S3-compatible storage, and a replaceable OpenAI Responses adapter. A Docker runtime and CI workflow are prepared; hosting is not provisioned. Client hosting/AI accounts, actual assessment content and configuration remain inputs.

Production PostgreSQL holds structured records and authoritative state. Object storage holds permitted Listening audio and Writing images/charts; database records hold metadata/authorization references. No Speaking audio is collected in this scope. Production must never use in-memory/browser persistence as a replacement for PostgreSQL.

## Domains and data responsibilities

| Domain | Responsibilities and conceptual entities |
| --- | --- |
| Identity | Admin/Trainer/Student credentials, secure hashes, enabled status, sessions and Admin-controlled resets. |
| Students and contacts | Single course assignment, access dates, academic profile; separate Admin-only contact fields/records. |
| Trainer assignment | Student-to-Trainer routing, assignment history, pending-work reassignment and workload. Not access entitlements. |
| Question Bank | Course eligibility, module, required question-type/section tags, difficulty, options/keys, passages, prompts, assets and publication/versioning. |
| Practice | Course-qualified sets, module/type/section selection, answers and history; no availability toggle. |
| Test catalogs | Practice Mock and FLT definitions, sections/questions/order/durations, publication; FLT-only course availability. |
| Attempts | Owner, original course/test version/type, attempt number, lifecycle, current section/question, flags, remaining time and interruption count. |
| Answers | Acknowledged durable responses, revision/sequence, safe retries and final submission. |
| Attempt sessions | Server-confirmed active signals, stop/resume logs, review flags, concurrency control. |
| Evaluation | Automatic raw score, table version, Writing AI job/output/criteria, Trainer review, offline Speaking criteria/date/remarks. |
| Score history | Original/automatic/AI/Trainer/Admin/final values, immutable revisions, actor/role, old/new score, remarks and timestamp. |
| Results/release | Unrounded/rounded three- or four-skill result, explicit evaluation and release states, Admin release actor/time and release batches. |
| Display preferences | Theme and font size per Practice Mock/FLT attempt. |
| Notifications | Role/recipient-scoped in-app events and read state; no external messaging. |
| Import | CSV/XLSX staging, validation preview, confirmation, per-row outcome/error export, import audit. |
| Reporting | Authorized academic/operational aggregates, latest Practice Mock attempt rule, Trainer workload/turnaround and pagination. |
| Settings/audit | Approved operational settings and versioned conversion tables; traceable privileged actions without secrets. |

Do not initialize entities for excluded future features simply because Annexure A lists them as possible later additions. In particular no live digital Speaking pipeline, individual unlock table, student credits, extra-attempt override, Super Admin, batch or branch model is required.

## Authorization and field privacy

Staff passwords grant a restricted five-minute challenge. TOTP secrets use account-bound AES-256-GCM; full staff sessions require verified enrollment with recovery-code acknowledgement or a fresh factor. Database row locks serialize TOTP/recovery consumption and prevent replay. Password/MFA proof expires after five minutes for sensitive staff writes; the shared client verification dialog retries a rejected write once after successful verification. Session/challenge authorization versions are checked against current database records. Student sign-in and fixed credential restrictions remain unchanged.

A per-process bounded Fastify request limiter runs before authentication/database work with a deliberately generous 30,000-request/minute socket-source ceiling for shared gateways. It ignores untrusted forwarding headers. Durable canonical-account password/MFA and authenticated-write limits remain in PostgreSQL. This process-level backstop is not distributed edge/DDoS protection; provider ingress controls and production capacity need separate verification.

Every protected API and media request must evaluate authenticated role, current account status, scope, ownership and relevant lifecycle. Refresh stale authorization claims when Admin changes course/status/access; a client route parameter or cached token claim alone is insufficient.

| Operation | Server checks |
| --- | --- |
| Student protected action | Authenticated enabled Student, valid start/expiry dates. |
| Read/submit practice | Active Student, assigned-course eligibility, published permitted content. No availability unlock. |
| Start Practice Mock | Above checks plus published eligible test and fewer than two started attempts. |
| Start FLT | Above checks plus course-level availability ON and no previously started attempt. |
| Save/resume/submit | Owner, immutable attempt/course context, valid lifecycle, server-authoritative time, access-change policy and concurrency/version checks. |
| Read student result | Owning Student with active access, scored practice result or explicitly released FLT result; no unreleased details in any projection. |
| Trainer read/evaluate | Enabled Trainer may access any student's academic data; never contacts/credentials or enrollment/access mutation. |
| Admin operations | Authorized Admin; validate input and audit account/content/availability/assignment/evaluation/release changes. |
| Release FLT | Admin only; evaluated L/R/W and allowed release state; Speaking may be pending. |
| Staff/media/reports | Role-specific field selection and media entitlement, including search/export paths. |

Represent FLT access as `COURSE + FLT + AVAILABILITY`. Never add `STUDENT + TEST + PERMISSION`, an individual allowlist, credit balance, extra-attempt grant or equivalent bypass. Publication is independent from availability; a published Practice Mock has no course-level unlock toggle.

Trainer assignment selects a default queue and notification recipient. It must never become a restriction preventing other Trainers from evaluating the student. Remove contact data through explicit backend projections/DTOs before serialization; do not fetch then hide it in UI. Retain original reviewer/audit identity on reassignment.

## Attempt transactions and recovery

Start attempts transactionally in PostgreSQL. Lock/serialize the relevant student/test counter or enforce an equivalent database constraint so concurrent starts cannot exceed two Practice Mock attempts or one FLT attempt. Count at start, preserve all attempts, and make duplicate/retried start and final-submit requests idempotent. Resuming never creates another attempt.

Store immutable test/content and conversion versions or snapshots for interpretable historical results. A test edit/unpublication must not silently rewrite acknowledged responses or previously calculated results. Define active-attempt behavior for course reassignment, account expiry/disablement, content updates and availability changes before deployment.

Implement the SOW's **connected-time** policy, not a wall-clock deadline that keeps running while disconnected:

1. Browser sends a sequenced active signal every few seconds, with answer changes and section/question position.
2. Server validates identity, attempt/session/revision and active status, persists acknowledgment and authoritative remaining time together.
3. Deduct only elapsed periods between confirmed active signals. When signals stop, do not continue charging disconnected time.
4. Resume validates the same attempt, restores acknowledged answers/position/time/preferences and logs the interruption/resume.
5. Flag for Admin review when interruptions exceed the configured limit (default 3). No manual Pause action exists.

Choose heartbeat interval, stale-gap tolerance, trusted server time source, duplicate/out-of-order signal rules, session takeover/concurrent tabs, outage reconciliation and transactional recovery explicitly. Do not claim a browser timer or localStorage meets this guarantee. A device clock must never change remaining time; a failed acknowledgment must not be displayed as server-saved. Confirmed saved answers survive browser crashes and server restarts.

## Evaluation, calculations and release

Keep objective scoring, AI job status, Trainer review, Speaking completion and release state separate. Speaking Pending can coexist with Ready for Release or Released if Listening/Reading/Writing are complete. Prevent a single UI status from making pending skills disappear.

Writing submissions are durably saved before AI processing. Use idempotent versioned jobs, schema/range validation of returned criteria, stored provider/rubric/output metadata, bounded retries and an explicit Failed/Retry Required state. Staff may evaluate manually without losing failed/original AI output. API keys stay server-side. AI-generated feedback is untrusted content and cannot authorize tools, mutate access, or bypass score validation.

Pure band calculations follow PRD.md/SOW A28.1: course-specific Reading tables; common Listening table; four equal Writing criteria per task, Task 2 weighted twice; four integer Speaking criteria from 0-9; half-band rounding at .25/.75; four-skill average or labelled three-skill FLT average while Speaking is pending. Practice Mock overall is a three-skill practice result. Missing required L/R/W scores produce pending, not zero or a reduced average.

The SOW table omits raw 0-9 for Listening/Academic Reading and raw 0-8 for General Reading. Return an unconfigured/pending conversion until an approved table is supplied. Do not interpolate undocumented bands. Admin changes require full-range non-overlapping table validation, a new version and audit; historical results retain their applicable version.

Score changes require remarks, validate range/step, append previous/new value plus actor/time/source, recalculate final scores and retain original automatic/AI evaluations. Use optimistic version checks and a visible reviewer-presence mechanism so concurrent staff edits do not silently overwrite each other.

Admin release is a durable audited operation supporting single/selected/test/course batches with explicit eligible/skipped outcomes. Default blocks missing L/R/W evaluation or failed AI without manual resolution; pending Speaking alone is permitted. Notify only after committed release. Later offline Speaking updates recalculate released results and notify the owner. Clarify A62's exceptional incomplete release versus A65's prohibition before adding any additional bypass.

## Bulk data, notifications and reporting

CSV/XLSX assignment import stages parsed records, validates schema/size, required IDs, existing enabled target accounts, duplicates and course consistency, then presents a preview before confirmation. Commit valid rows according to a documented atomic/partial policy and return every row's outcome; never silently drop errors. Protect export files from spreadsheet formula injection. Preserve assignment/reviewer history and audit actual actor/import ID. CSV/XLSX templates define question/key and test-structure schemas, including JSON fields.

Notifications are server-generated, recipient-scoped and transactionally tied to committed domain events. Result links must recheck ownership and release. Reports/leaderboard must use authorized projections, with no unreleased student scores, private answers, contact leakage or invented values. Use latest Practice Mock attempts in progress/leaderboard; The replaceable defaults for ranking/windows and access dates are recorded in PRD.md.

## Security and operations

- Hash all passwords with a suitable password-hashing library and protect authentication/session endpoints against abuse. Never persist plaintext passwords or expose reset credentials in logs.
- Keep database/AI/storage secrets server-side and outside committed `.env` files; validate/sanitize requests and rendered feedback.
- Restrict object uploads/downloads with role checks, content/type/size limits and controlled URLs. Record no Speaking media in current scope.
- Audit account/date/course/credential changes, assignments, publication/availability, score/table revisions, release, imports and attempt interruption/resume.
- Define retention/deletion, encryption/access controls, PostgreSQL backup/restore verification, monitoring, job failure handling and deployment rollback before production.
- Configure date boundaries, learner-content rights, browser/media compatibility and quantified load/recovery targets before rollout.

## Verification boundaries

Frontend checks cover TypeScript/build/lint, calculation boundaries, preview transitions, form validation, navigation, release visibility, offline Speaking and responsive layouts. Validate all theme/font combinations at 1440/1280/1024/768/430/390 px and keyboard drawer/sidebar behavior. Existing script names do not imply every category already has a completed test suite.

Production acceptance additionally requires integration tests against real PostgreSQL for role/field/course/owner isolation, access dates, publication/availability, race-safe attempt limits, durable save/retry/heartbeat recovery, score history/release, import outcomes and notification privacy. Exercise disconnect/refresh/crash/server-outage cases and concurrent evaluations/starts. Frontend fixtures cannot prove these guarantees.

## Implementation map and setup

`backend/src/app.ts` registers protected routes and request/error handling; `auth.ts` handles sessions, credentials, role checks and throttling; `accounts.ts`, `content.ts`, `attempts.ts`, `evaluation.ts`, `imports.ts`, `reports.ts`, `settings.ts`, `storage.ts` and `worker.ts` own domain operations. `views.ts` creates explicit role-specific projections. `prisma/` holds the schema and eight migrations. `scripts/` provides local PostgreSQL, initial Admin/catalog setup and isolated browser-test fixtures.

The frontend `LiveProvider` is the default; `DemoProvider` is selected only at build/dev time through VITE_DEMO_MODE=true. `Protected` checks navigation identity while the API independently enforces authorization. `LiveExam` restores a server snapshot and posts sequenced answer/preference/time-position signals. A rejected save remains visibly unsaved and never changes to a success badge without acknowledgment.

Prisma generates to ignored `backend/src/generated/prisma`. Build output is ignored. Local/test PostgreSQL files live only under ignored backend/.local and backend/.test-data. Production uses a configured real PostgreSQL service, never the test harness or in-memory records.

The API is same-origin in production. Vite proxies /api during development. Cookies are HttpOnly/SameSite=Strict and Secure in production; state-changing requests require the configured Origin and session CSRF token. Authentication and cache policy follow registered API route metadata, including percent-encoded spellings, rather than raw URL prefix matching. New passwords use scrypt (N=32768,r=8,p=3,random salt), with at most two hashing jobs active and a bounded queue. Existing p=1 hashes remain verifiable and upgrade by compare-and-swap on successful login without overwriting concurrent credential resets. Login throttles are stored in PostgreSQL and use canonical account IDs across login aliases, plus source/account keys; one shared proxy address cannot exhaust an unrelated account's low login bucket. Forwarded IP headers remain untrusted by default. Production still needs validated edge abuse controls. Admin credential resets increment authVersion, invalidating old sessions.

Default connected-time policy: 3-second client signals, 7.5-second continuity tolerance, per-section millisecond balances and a persisted sequence. All time uses server timestamps. Only a server-observed stale gap establishes an interruption; an unverified client reconnect flag cannot waive a continuous interval. Gaps within the tolerance count as continuity, including brief network/visibility transitions; HTTP heartbeats cannot prove activity or disconnection inside that window. A stale gap does not consume the stored balance, and more than the configured interruption limit (default 3) flags review. New/changed answers must belong to the server's current timed skill; section transitions save that skill's answers before changing position. Inactive answers survive sparse updates and closed-section answers remain frozen. The browser waits for transition acknowledgement and blocks editing through failed/pending transition retries. Section expiry advances to a remaining section. Duplicate final submission returns the already-submitted attempt. PostgreSQL row locks/serializable retry and partial unique indexes protect starts.

Writing jobs are leased with SKIP LOCKED, bounded retry and stored provider/rubric/output history. Manual Writing revisions remain authoritative if a late AI response arrives. AI keys/model are configurable; missing configuration produces an explicit failure/manual-review state. No AI result is simulated in live mode.

S3 credentials stay on the server. Uploads are Admin-only and size-limited. PNG/JPEG/WebP images are fully decoded and re-encoded without metadata, with a 16-million-pixel input bound. MP3 frame boundaries are validated, tags removed and audio decoded in a worker; PCM/IEEE-float mono/stereo WAV requires consistent complete chunks/sample layout. Only one media validation runs per process at a time, and the normalized output must also fit the configured byte limit. This is format validation, not malware scanning. Student media streaming rechecks access and entitlement on each request; Speaking media is never collected. Media from submitted unreleased FLTs is withheld from students until release. Trainer bootstrap never loads the question bank or includes test builders/conversion tables; submitted-record evaluation still delivers the authorized historical questions/keys.

Database constraints enforce one student course, FLT slots/attempt limits and independent availability. Database triggers preserve attempt context and make audit/score revision records append-only. Original content/scores and revisions are retained; production still needs an operational least-privilege database role, backup retention and restore exercises.

See README.md for local commands and docs/DEPLOYMENT.md for configuration and deployment gates. Docker/CI definitions are prepared but have not been executed on this machine, which has no Docker service. External S3/AI calls, complete licensed content, low-band tables, production load testing and UAT remain required.

Save idempotency persists a canonical request fingerprint beside the sequence. Retrying the same revision/payload returns its acknowledgment; a different payload at the same sequence is rejected as a conflict. The browser retains the exact pending payload until acknowledgment and keeps newer local edits separate for the next revision. Listening/Reading module practice is untimed; Writing uses the configured task reference timer, and all practice records retain acknowledged active duration.

## Completed application workflows (content deferred)

The user deferred real question papers, audio and images. Empty/draft catalogs are an expected operational state, not a reason to simulate live assessments. The media library lists private assets and supports reuse from the editor; publication validates actual audio/image types. Content is imported or authored later.

Reports are a dedicated protected workflow with date/course/type/test/Trainer/student/module/question-type filters, sorting, pagination, latest-Practice-Mock performance aggregates, objective accuracy, access counts, reviewer workload/turnaround and formula-safe CSV export. Aggregates read server batches across all matching records. Trainer projections never fetch contacts. The operational dashboard exposes configured integrations and job/flag counts without provider secrets; Admin can record interruption reviews while retaining flags/logs.

An attempt stores submittedSections. A section submission saves its last valid answers before ending unused time and advancing; closed sections cannot be edited or reopened. Final submission and exact-payload retries remain idempotent. Reading navigation follows the selected question's passage; question flags, position, Writing task selection and theme/font preferences persist with acknowledged saves. Module Writing selects a single prompt and uses its task timer; staff can complete module-only review without fictitious other-skill marks.

Results capture assignedTrainerId at submission. Updating a Student assignment routes new work; moving existing pending work requires an explicit movePending choice (or the optional Move Pending import column). Score revisions and actual reviewer identity remain unchanged. Evaluation forms keep their editing version until a successful own save; external changes require reload rather than silently adopting a newer version.

Platform settings merge validated defaults for support details, new-account access duration, media size, automatic Writing jobs, expiry/backlog reminders, interruption threshold and optional leaderboard. Required domain-event notifications and fixed business prohibitions remain mandatory. Admin announcements and recipient-scoped read-all are connected. Conversion audit entries retain previous/new tables, and score history displays actor/role/time.

Session initialization, sign-in and data refresh use a client generation counter: an older identity/bootstrap response cannot replace a newer signed-in account. Server cookies and per-request authorization remain authoritative. Writing task images are read privately for the AI request and never turned into public bucket objects. Provider request/task validation preserves exact task identity and the original/manual score history.

Report processing projects only question IDs/module/type/keys and objective responses in PostgreSQL; passage/prompt/essay bodies are excluded from history aggregation. The application retains compact aggregates in bounded input batches rather than full paper snapshots. Transaction retries handle raw-query adapter SQLSTATE 40001/40P01 metadata as well as Prisma P2034, with bounded jitter and 409 on exhausted contention. Reviewer presence claims reuse a fresh same-user lease, avoiding unnecessary writes.

## Original practice pack

backend/content holds a versioned original draft pack, import CSV and recording script; answer keys are not imported into frontend assets. src/practice-pack.ts validates the pack and performs an explicit, Admin-audited, idempotent installation without replacing existing questions or changing FLTs/attempts/results. scripts/install-practice.ts supports an import-compatible CSV export and explicit database installation. There is no automatic startup/seed insertion. The public repository and deployment image exclude assessment source files and answer keys; only a content README is included. The optional installer accepts PRIVATE_PRACTICE_PACK_PATH for approved runtime-mounted private content. Tests use synthetic fixtures and do not depend on the local pack. Original Stitch archives remain local and are also excluded from the public repository.

External official-resource links have been removed from the portal at the user?s request.


## Testing hosting configuration (27 October 2026)

The testing target is GitHub `Sarthak-1004/leo-p`, a Vercel frontend and a Render API/PostgreSQL deployment. Render replaces the earlier Railway target because the owner cannot currently sign up there. The owner selected free hosting for initial testing. `render.yaml` defines a free Docker web service and free PostgreSQL 18 database in Singapore, connects via the private database URL and blocks external database access. Docker health checks use the host-provided PORT.

Free Render services do not support pre-deploy commands or shell access. The Blueprint invokes `/app/backend/scripts/start-container.sh` directly; the executable POSIX script runs the existing migration and idempotent bootstrap scripts before starting the API with exec. Keeping the command in a file avoids provider-specific handling of quoted shell commands. Build/runtime images share a Debian base with OpenSSL and CA certificates installed for Prisma and provider TLS. Bootstrap creates a first Admin only if none exists, preserves existing credentials/settings/tests and creates only the 80 empty draft FLT slots. Render generates the bootstrap password as a protected environment value; it is never committed or printed. The Writing/maintenance worker runs with the API. Render suspends an idle free API after 15 minutes, so jobs/reminders cannot run during idle suspension; its free database expires after 30 days. This is a temporary developer testing environment, not an always-running production deployment.

`vercel.json` builds from the repository root using `npm run build:vercel`. The script validates BACKEND_ORIGIN, rejects fixture mode and writes Build Output API v3 routes/static files. `/api` is reverse-proxied to the API before SPA fallback, preserving a same-origin browser session and exact APP_ORIGIN/CSRF enforcement. API responses and proxy routes explicitly prohibit CDN caching. Secrets exist only in the backend host environment; BACKEND_ORIGIN is a public service origin. Each deployment must use the matching stable frontend origin; arbitrary preview URLs are not authorized automatically.

Hosting account connections, provider resource creation, first hosted Admin bootstrap and hosted smoke checks remain separate deployment steps; these configuration changes do not certify a running service. See docs/DEPLOYMENT.md for the exact sequence.
