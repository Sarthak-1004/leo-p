# Kanan IELTS Portal: Code Audit, 3 November 2026

Scope: the full backend (`backend/src`, Prisma schema and migrations), the frontend API layer, routing, the live exam and audio components, and the deployment configuration (Dockerfile, `render.yaml`, Vercel build). The rules in AGENTS.md and PRD.md were the baseline.

Method: manual code review, the project's own checks, and a throwaway proof-of-concept test run against real PostgreSQL. The proof-of-concept file was deleted afterwards and nothing in the repository was changed.

## Verdict

The engineering quality is well above average. Authorization is enforced on the server, sessions and CSRF are handled correctly, trainers never receive contact details, writes use serializable transactions with version checks, the audit and score tables are append-only, uploaded media is validated, and CSV exports are protected against formula injection. All 55 backend tests pass.

**However, the portal is not ready for real FLTs.** Two confirmed flaws let a student defeat the exam itself: they can get the FLT answer keys in advance, and they can stop the clock indefinitely. Both need fixing before any graded test runs.

| Severity | Count |
|---|---|
| Critical | 2 |
| High | 3 |
| Medium | 6 |
| Low | 7 |

## Checks run

| Check | Result |
|---|---|
| Backend `npm test` (55 tests, embedded PostgreSQL) | All pass |
| Backend `npm run typecheck` | Clean |
| Frontend `npm run typecheck` / `npm run lint` | Clean |
| Frontend `npm audit --omit=dev` | 0 vulnerabilities |
| Backend `npm audit --omit=dev` | Moderate: `glob` advisory reached through `@fastify/static` and `exceljs`. Untrusted glob patterns never reach it, so the practical risk is low. |
| Proof-of-concept exploits C1, C2 and H1 | All reproduced (see below) |

Not covered: browser and E2E runs, the deployed Render/Vercel environment, load testing, and the S3 and OpenAI integrations.

---

## Critical

### C1. FLT answer keys can be read through module practice

**Proven.** A student obtained the answer key for an unattempted FLT question.

How it happens:
1. New questions are practice-eligible by default. The editor checkbox defaults to on ([Questions.tsx:259](../frontend/src/pages/admin/Questions.tsx#L259)), the API schema defaults to `true` ([domain.ts:52](../backend/src/domain.ts#L52)), and CSV/XLSX imports default to `true` ([imports.ts:57](../backend/src/imports.ts#L57)).
2. The test builder never checks whether a question is also practice-eligible ([content.ts:40-44](../backend/src/content.ts#L40-L44)).
3. A student starts practice and targets the exact question by `questionId` ([attempts.ts:41](../backend/src/attempts.ts#L41)), submits it blank, and opens the result. For practice results, `GET /api/results/:id` returns every question with its answer and explanation ([app.ts:126](../backend/src/app.ts#L126)).
4. Separately, the student's `/api/bootstrap` already returns the prompts and passages of every practice-eligible question, so in the proof of concept all 82 FLT questions were visible.

Proof-of-concept output:
```
POC-1 practiceEligible after API save: true
POC-2 FLT question prompts visible in student bootstrap: 82
POC-2 result status 200 leaks FLT key: true
```

Fix:
- In `saveTestRecord`, reject any question that is practice-eligible when it is placed in an FLT or Practice Mock. Also block turning on practice eligibility for a question that any test already references.
- Change the default to `false` in the Zod schema, the import parser and the editor checkbox.
- Add a migration that sets `practiceEligible = false` on every question already referenced by a test builder.
- Add a regression test.

### C2. A student can stop the FLT clock without limit

**Proven.** Three simulated hours offline cost zero seconds, and the attempt was not flagged.

How it happens:
- Time is deducted only when the gap between heartbeats is 7.5 seconds or less. Any longer gap counts as an interruption and deducts nothing ([attempts.ts:69-73](../backend/src/attempts.ts#L69-L73)). This matches PRD §71.
- The client stops sending heartbeats whenever the tab is hidden ([LiveExam.tsx:19](../frontend/src/pages/student/LiveExam.tsx#L19), [LiveExam.tsx:40](../frontend/src/pages/student/LiveExam.tsx#L40)). Simply switching to another browser tab freezes the timer, with no network tricks needed.
- The full snapshot is sent at start: every Listening, Reading and Writing question in one response ([views.ts:15](../backend/src/views.ts#L15)). The student can read the whole paper, leave the tab, research or prepare for as long as they like, then return.
- The student can switch freely between sections, so the paper does not run in order.
- Each gap costs only one interruption, and flagging starts after more than 3. Even a flagged attempt carries no consequence beyond Admin review.

Proof-of-concept output:
```
POC-3 Writing prompts delivered at FLT start: true
POC-3 remaining before/after 3 offline hours: 9000 9000 interruptions: 3 flagged: false
```

Fix (the first two stay within the PRD):
1. **Keep the clock running while the tab is hidden.** A hidden tab is still connected. Only an actual network loss should stop heartbeats.
2. **Send only the active section's questions.** Return Reading and Writing content only once that section opens, in both start and resume.
3. Ask the client to decide (this is policy, not code): make FLT sections strictly sequential with no going back, and set a maximum wall-clock time from FLT start, after which the attempt is auto-submitted or force-flagged.
4. Record hidden-tab time separately in the attempt log as evidence for Admin review.

---

## High

### H1. Anyone can lock a student or staff member out of their account

**Proven.** After 12 wrong guesses, the correct password returned `429`.

The per-account throttle is counted before the password is checked, and it counts every attempt ([app.ts:89-90](../backend/src/app.ts#L89-L90)). Anyone who knows or guesses an assigned ID, which is often sequential, can keep a student locked out, for example just before an FLT, by sending 12 requests every 15 minutes. Because Vercel proxies the API, every user arrives from the same few IP addresses, so per-source limits cannot separate the attacker from the victim.

Fix: before verification, only read the failure count. Increment it only when a login fails, and clear it when a login succeeds. Consider progressive delays instead of a hard block, and keep the Admin alert.

### H2. Practice Mock answer keys appear between the two allowed attempts

Once attempt 1 of a Practice Mock is scored, the result page returns every question with its answer key ([app.ts:126](../backend/src/app.ts#L126)). Attempt 2 uses the same test, so the student can score full marks. The leaderboard and reports use the latest attempt per test ([app.ts:150](../backend/src/app.ts#L150), [reports.ts:58](../backend/src/reports.ts#L58)), so the inflated score is what gets counted.

Fix: withhold keys and explanations for a Practice Mock until both attempts are used, or until the student confirms they will not take another attempt. Alternatively, rank by the first attempt.

### H3. Abandoned or expired attempts are never closed

Nothing ever ends an `IN_PROGRESS` attempt. The maintenance job ([maintenance.ts](../backend/src/maintenance.ts)) only clears sessions and sends reminders. If a student abandons an FLT, or their access expires during one:
- the single FLT attempt is used up but never produces a result,
- the trainer never receives a marksheet,
- Admin has no way to close or submit it.

Also, Admin and Trainer cannot open an in-progress attempt at all: `GET /api/attempts/:id` calls `staff()` and then `resumeAttempt()`, which requires a student, so staff always get 403 ([app.ts:119](../backend/src/app.ts#L119), [attempts.ts:113](../backend/src/attempts.ts#L113)).

Fix: give Admin an audited "force submit" action that scores whatever answers were saved. Optionally, the maintenance job can auto-submit attempts that go past the wall-clock ceiling from C2. Also fix the staff read path.

---

## Medium

| # | Finding | Location | Recommendation |
|---|---|---|---|
| M1 | The runtime database role runs migrations, so it owns the schema. Anyone who compromises the app could drop the append-only triggers on `AuditLog` and `ScoreRevision`. The portal's own security endpoint reports `leastPrivilegeVerified:false`. | [start-container.sh](../backend/scripts/start-container.sh), [app.ts:162-164](../backend/src/app.ts#L162-L164) | Use separate migration and runtime roles. Give the runtime role DML only, with no `DELETE` or `UPDATE` on the history tables. |
| M2 | Listening audio in mocks and FLTs has full native controls, so students can seek, rewind and replay. Only the first attached audio asset ever plays. | [ListeningAudio.tsx:6](../frontend/src/components/ListeningAudio.tsx#L6) | Get the client's decision on audio rules (PRD §207 leaves this open). Support multi-part audio. |
| M3 | A trainer can set an auto-scored L/R band to `null` on a released FLT. The database check `release_requires_scores` then rejects the update, and the user sees a generic 500 error. | [evaluation.ts:22-36](../backend/src/evaluation.ts#L22-L36) | Reject null L/R/W on released FLTs with a clear 400 error. |
| M4 | Every reports request reads the entire result table and all attempt snapshots in batches of 500. Bootstrap also loads up to 500 rows of each entity on every refresh, and the app refreshes after every mutation. | [reports.ts:32-56](../backend/src/reports.ts#L32-L56), [LiveProvider.tsx:22](../frontend/src/app/LiveProvider.tsx#L22) | Fine for a pilot, but this will slow down as data grows. Add pagination or aggregation in SQL, and do targeted refreshes. |
| M5 | Announcements and "FLT available" notices insert one row per student inside a serializable transaction. A large cohort risks hitting the 20-second timeout and causing retry storms. | [app.ts:138](../backend/src/app.ts#L138), [content.ts:60-63](../backend/src/content.ts#L60-L63) | Use `createMany`. |
| M6 | The free Render PostgreSQL instance expires after 30 days. This is documented, but it remains a real risk of losing data. | [render.yaml](../render.yaml) | Before any real students use the portal, move to a paid or persistent database with backups that have been restore-tested. |

## Low

| # | Finding | Location |
|---|---|---|
| L1 | `Asia/Kolkata` and `+05:30` are hard-coded even though `ACCESS_TIMEZONE` is configurable. | [views.ts:49](../backend/src/views.ts#L49), [reports.ts:20](../backend/src/reports.ts#L20), [reports.ts:64](../backend/src/reports.ts#L64) |
| L2 | The XLSX zip-bomb guard trusts the uncompressed sizes the file itself declares, which can be faked. Only Admins can upload. | [imports.ts:11-23](../backend/src/imports.ts#L11-L23) |
| L3 | Dashboard progress always reports `percent:0` and `total:0`. | [views.ts:46](../backend/src/views.ts#L46) |
| L4 | `:id` route parameters on attempts, notifications and imports are not validated as UUIDs, unlike the asset and result routes. | [app.ts:119-140](../backend/src/app.ts#L119-L140) |
| L5 | The global rate limit of 30,000 requests per minute per proxy IP gives little protection against floods. Edge-level limits on Vercel or Render are needed. | [app.ts:46](../backend/src/app.ts#L46) |
| L6 | Backend `npm audit` reports the moderate `glob` chain. Track the Dependabot update for `@fastify/static` and `exceljs`. | backend/package-lock.json |
| L7 | Very dense one-line code style: `app.ts` is 23 KB in 180 lines, with many routes defined in a single line each. This makes reviews and diffs hard and hides bugs like H3. Consider splitting routes by area and letting a formatter run. | backend/src |

---

## What is done well (keep it)

- Server-side enforcement of role, course, access dates, ownership, publication, course-level FLT availability and attempt limits, backed by database `CHECK` constraints and a partial unique index.
- Trainer responses never fetch contact details; this is verified by a test.
- Session cookies are `HttpOnly`, `SameSite=Strict` and `Secure`. Writes require an origin check plus a CSRF token, and sessions are revoked when an account changes (`authVersion`).
- scrypt password hashing with an upgrade path, constant-time comparison, and equal timing for unknown accounts.
- Recent password confirmation is required for sensitive staff actions.
- Serializable transactions with retry, plus version checks on questions, tests and marksheets.
- Attempt snapshots cannot be changed afterwards, and the audit and score history tables are append-only.
- FLT release rules match the PRD, including releasing with Speaking pending, notifying once Speaking is added, and never treating missing L/R/W as zero.
- Listening speed controls appear only in module practice. There is no student Speaking path.
- Uploaded media is fully decoded and stripped of metadata. Spreadsheet formulas are rejected, and CSV exports are protected against formula injection.
- Writing AI prompts treat essays and figures as untrusted data, enforce a strict output schema, retry with backoff, and preserve the original AI score.

## Recommended order

1. Fix C1 and C2. Neither is large: C1 is a check plus defaults and a migration; C2 starts with two client/server changes. Add regression tests based on the proof-of-concept cases above.
2. H1 and H3, then get the client's policy decisions for C2 step 3, H2 and M2.
3. M1 and M6 before any real student data goes in.
4. Medium and Low items as normal backlog.
