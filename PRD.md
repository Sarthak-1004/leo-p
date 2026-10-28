# Kanan IELTS Practice Portal - Product Requirements

## Source and implementation status

Updated 27 October 2026 against **Kanan IELTS Portal Scope of Work**, reference **SOW-KANAN-IELTS-001**, version **1.0**, dated **20 October 2026**, including Annexure A (A1-A75). The supplied PDF replaces earlier product assumptions where the requirements differ. Its commercial terms, sign-off placeholders, and future-feature descriptions are source context; they do not authorize publishing, accepting commercial terms, or enabling excluded features.

The React/TypeScript/Vite frontend in `frontend/` preserves the audited Stitch designs. The full-project implementation now adds a PostgreSQL API, authenticated frontend mode, durable attempts and operational workflows. The scope below remains the delivery specification. Core authentication, protected APIs, PostgreSQL persistence, attempts, evaluations and CSV/XLSX imports are implemented and tested locally. S3 and Writing AI adapters require external configuration and live-service verification. Deployment, complete client content, full-range conversion tables, production load/restore testing and UAT are still required. The fixture preview is an explicit optional mode.

## Purpose and roles

Provide Kanan.co Bharuch with an English-language responsive IELTS preparation and assessment portal for hundreds of active students, with separate Student, Trainer, and Admin experiences. Trainer and Teacher refer to the same role. There is one Admin role type; multiple staff may hold it.

| Role | Allowed responsibilities | Restrictions |
| --- | --- | --- |
| Student | Practise, attempt eligible tests, resume unfinished attempts, view own released results/history/progress, receive notifications. | Exactly one assigned course; no self-registration, password change/reset, course change, access extension, score editing, result release, or individual unlocks. |
| Trainer | View academic information for all students; review any marksheet; enter offline Speaking marks; override scores with remarks; see own queue/workload and notifications. | No student contact details, account/credential/course/access changes, global FLT unlocks, trainer management, settings, or result release. |
| Admin | Manage students, trainers, assignments, access, content, tests, evaluation, result release, reports, notifications, settings, and audit history. | Fixed business rules are not optional toggles. Overrides must retain history and remarks. |

Trainer assignment routes evaluations, notifications, and workload; it does **not** restrict access to other students' academic records. Student phone, email, address, guardian contact, and other contact information must be removed from every Trainer-role response, search result, report, and export on the server.

## Non-negotiable business rules

1. Each student belongs to exactly one course: IELTS GENERAL or IELTS ACADEMIC. Only Admin can reassign that course. The other course is locked where shown.
2. Access requires an enabled account and a valid start/expiry period. Expired, disabled, and not-yet-active students cannot use protected functions. Historical results are not viewable after expiry by default.
3. Module practice and published Practice Mock Tests need no Admin availability unlock during active access.
4. Each course contains exactly 40 Full Length Tests (FLTs). Publication and course-level availability are separate, and General/Academic controls are independent.
5. Never create per-student FLT permissions, credits, extra-attempt grants, or exceptions. Attempts are activity records, not access entitlements.
6. Practice Mock Tests allow two attempts per test; FLTs allow one. An attempt counts when started. Resuming the same attempt does not consume another attempt.
7. Digital Speaking is disabled. Students cannot open, record, or submit Speaking practice/tests. Speaking takes place offline; Trainer/Admin enters marks. No Speaking recording, transcript, or AI evaluation is in scope.
8. Practice results appear after scoring without Admin release. FLT results remain private to staff until Admin releases them.
9. Students use office-issued credentials. Student registration, forgot-password, and password-change controls must not exist. Admin controls student and trainer accounts/credentials.
10. Server-side checks enforce roles, course eligibility, account/access validity, private ownership, publication, availability, attempt limits, and result release. Frontend hiding is insufficient.
11. Passwords are securely hashed. Secrets and plaintext credentials never belong in frontend assets, committed environment files, logs, or exports.
12. Production persistence uses real PostgreSQL. Mock/in-memory/browser storage is not production persistence.

## Accounts and access (A3-A6, A35-A36, A55-A56)

Students have a Student ID, name, one course, start/expiry dates, enabled status, and Admin-managed credentials; contacts are Admin-only fields. Admin creates/edits accounts, assigns a trainer, changes course/access dates, enables/disables access, and resets credentials. Preserve historical attempt course and evaluation ownership when assignments change.

Provide separate Student, Trainer, and Admin login routes. Every role signs in with its assigned ID (Student ID, Trainer ID or Admin ID) or recorded email, plus password, with a show/hide password control. Student email is the Admin-managed contact email. Case-insensitive email matching must resolve to exactly one account; shared/ambiguous emails require the assigned ID. Admin navigation remains separate from the student-facing experience. Preview login must never suggest that supplied credentials were authenticated.

The later 28 October user decision removes authenticator/MFA enrollment, verification, QR codes and recovery codes from every portal. A valid password grants the normal role session directly, including for previously enrolled staff; no authenticator key is required for startup or sign-in. Sensitive staff writes may request a fresh password confirmation after five minutes, with no second factor. Login throttling, secure password hashing, CSRF/origin checks, account/access checks and role authorization remain mandatory. Accounts remain Admin-managed, with no public signup or Student self-registration/password-reset flow. This supersedes the earlier mandatory-MFA hardening decision.

Expired access shows name, course, expiry date, and office contact guidance. Date timezone/boundary semantics and effects of mid-attempt disablement, course reassignment, expiry, unpublishing, and availability changes must be settled before production enforcement. Resumption never bypasses authorization.

## Practice and test types (A8-A18)

| Property | Module practice | Practice Mock Test | Full Length Test |
| --- | --- | --- | --- |
| Content | Listening, Reading, or Writing | Listening + Reading + Writing | Listening + Reading + Writing online; Speaking offline |
| Selection | Question-type-wise or section-wise | Complete test | Complete test |
| Availability | Published, course-eligible content during active access | Published, course-eligible content during active access | Published, course-eligible test with course-level availability ON |
| Catalog size | Client-supplied content | **Client confirmation required per course** | 40 General and 40 Academic |
| Attempts | No numeric limit specified in SOW | 2 per test | 1 per test |
| Listening speed | 1x, 1.5x, 2x; reset to 1x for each new attempt | Normal only, no speed control | Normal only, no speed control |
| Results | Visible after scoring | Visible after scoring; no required Trainer review | Admin release required |
| Display preferences | Portal styling | Three themes and three font sizes | Three themes and three font sizes |

Practice history retains submitted attempts. Question-type selection includes relevant IELTS formats (for example multiple choice, matching, completion, True/False/Not Given, and task type). Section selection includes Listening Parts 1-4, Reading Passages 1-3, and Writing Tasks 1-2. Question type and section tags are required in the Question Bank.

Listening provides real audio playback, play/pause, volume, progress, question navigation, answer submission, and answer-key scoring. Reading provides a scrollable passage, question panel, navigation, submission, and objective scoring. Writing provides the correct General letter or Academic visual/report Task 1, Task 2 essay, editor, word count, timer, submission, AI evaluation and staff review.

Speaking is greyed out with: **Speaking is conducted offline by your trainer.** Admin retains Speaking questions/cue cards for offline trainer use and future use; they are not delivered to students.

Both Practice Mock attempts remain in history. Progress charts and leaderboard calculations use the latest attempt. Completed FLTs show Completed; exhausted Practice Mocks show Attempts used (2/2). Unfinished attempts expose Resume in dashboard, catalog, and history.

### Assessment interaction and recovery (A17)

The shared Practice Mock/FLT interface includes test/section identity, countdown, question progress, previous/next, palette, flags, autosave feedback, section transitions, section submission, final submission, and display settings. Only Listening, Reading, and Writing are online sections. FLT instructions explain the single attempt and offline Speaking process.

The timer counts only while actively connected. A server-acknowledged heartbeat every few seconds saves answers, current section/question, and remaining time. Deduct time only between confirmed active signals; no time accrues after interruption from refresh, disconnect, browser close/crash, shutdown/power loss, or server outage. Resume restores acknowledged answers, position, and exact remaining time. A device clock change cannot add time. There is no manual Pause button.

Log stops and resumes with timestamps and remaining time. Flag attempts with **more than** the configured interruption limit for Admin review; default limit is **3**. Flagging does not grant another attempt. The policy also applies to timed module practice such as Writing. Production must define heartbeat interval/tolerance, concurrent-tab behavior, server outage recovery, and idempotent saves/submission before launch.

### Display settings (A17.2)

Practice Mocks and FLTs provide Black on white (default), White on black, and Yellow on black; Standard (default), Large, and Extra Large text. Exact final colour names/values require design confirmation. Apply to passage, questions, answer inputs, and instructions throughout the test. Save preferences with the attempt for resume. Do not apply these settings to dashboard, module practice, results, Admin, or Trainer screens. Validate all nine combinations at all supported widths.

## Student experience (A7, A30-A33, A70)

| Page | Required behavior |
| --- | --- |
| Dashboard | Name, course, expiry, overall/module progress, offline Speaking band/pending, recent results, available/completed FLTs, Practice Mock and practice shortcuts, resumable tests, notifications. |
| Practice | Listening/Reading/Writing, question-type and section selection; disabled Speaking card. |
| Practice Mock Tests | Course-qualified catalog, two-attempt status, instructions, resume, immediate scored-result access. |
| Full Length Tests | Forty assigned-course entries, separate availability/publication/completion states, single-attempt instructions, resume. |
| Test History | Type, date, status, evaluation state, attempt number, available scores, authorized result links, resume; type filters. |
| Result and details | Final visible scores, clearly labelled 3-/4-skill overall, date/time, released feedback, Writing criteria and submitted answer, offline Speaking criteria/date/remarks, appropriate objective answer review. |
| Profile | Student ID/name, course, access dates/status, progress/performance; no credential or enrollment editing. |
| Notifications | In-app events with appropriate destinations/read state. |
| Leaderboard | Optional feature with separate courses and weekly/monthly/overall views; first name plus last initial, optional avatar, rank and band only. |
| Locked/expired states | Short explanation and office guidance without protected content leakage. |

Unreleased FLT scores and detailed feedback must not leak through dashboard summaries, history, leaderboard, notifications, URLs, or APIs. History may expose a pending attempt/status without its private scores. Zero is a valid score; pending/unavailable is not zero.

## Evaluation, scores, and release (A19-A22, A28-A31, A47-A48, A60-A66)

Listening and Reading use answer keys; AI is not needed for objective scoring. Writing AI produces criteria bands, estimated task/overall band, feedback, strengths/weaknesses, corrections and improvement suggestions. Store the provider output for review. AI scores are estimates, never official IELTS certification. On failure retain the submission, show Failed/Retry Required, permit retry or manual Trainer/Admin evaluation, and withhold incomplete final results.

Trainers can review any student's Listening/Reading/Writing and offline Speaking, save draft/complete evaluations, add section/overall remarks, re-evaluate Writing, and override any section. Admin has the same evaluation authority and final release control. Preserve automatic score, original AI score, Trainer/Admin revisions, final approved score, previous/new values, actor/role/time, and mandatory remarks for every changed score. Do not overwrite original AI evaluation history.

Show Being checked by [name] when another Trainer is reviewing a marksheet. Assignment routes the default queue; any Trainer may review it. Audit the actual reviewer, including reviews outside their assignment.

### Default conversion tables from SOW A28.1

These are the supplied portal defaults, adjustable per test by Admin with versioned audit history. They are not asserted to be universal official test-version tables.

| Band | Listening (both courses) | Academic Reading | General Reading |
| --- | --- | --- | --- |
| 9.0 | 39-40 | 39-40 | 40 |
| 8.5 | 37-38 | 37-38 | 39 |
| 8.0 | 35-36 | 35-36 | 37-38 |
| 7.5 | 32-34 | 33-34 | 36 |
| 7.0 | 30-31 | 30-32 | 34-35 |
| 6.5 | 26-29 | 27-29 | 32-33 |
| 6.0 | 23-25 | 23-26 | 30-31 |
| 5.5 | 18-22 | 19-22 | 27-29 |
| 5.0 | 16-17 | 15-18 | 23-26 |
| 4.5 | 13-15 | 13-14 | 19-22 |
| 4.0 | 10-12 | 10-12 | 15-18 |
| 3.5 | Not supplied | Not supplied | 12-14 |
| 3.0 | Not supplied | Not supplied | 9-11 |

The SOW delegates scores below the lowest supplied rows to Admin-maintained tables without defining the mapping. Do not invent a conversion for Listening/Academic Reading raw 0-9 or General Reading raw 0-8. Full-range validated tables are required before production scoring. Module practice displays raw score and an estimated band only where the completed set supports it.

### Calculation rules

- Bands range 0-9, in whole/half steps unless a criterion explicitly requires whole values.
- Writing task band is the average of four equally weighted criteria: Task Achievement (Task 1) or Task Response (Task 2), Coherence and Cohesion, Lexical Resource, and Grammatical Range and Accuracy.
- Writing band = `(Task 1 band + 2 * Task 2 band) / 3`, rounded to nearest half using the rule below. This is the specified portal weighting.
- Offline Speaking has four equally weighted **whole-number 0-9** criteria: Fluency and Coherence, Lexical Resource, Grammatical Range and Accuracy, Pronunciation. Record test date, remarks, evaluator, and completion; round the average to nearest half. Changes to saved marks require remarks/history.
- Round fractional values below .25 down to the whole band, .25 through below .75 to the half band, and .75 or greater up to the next whole band.
- FLT overall is the equally weighted average of all four final skill bands. Until Speaking is entered, use Listening/Reading/Writing only and label **Overall (3 skills) - Speaking pending**. Once Speaking is saved, recalculate from four skills. The temporary three-skill figure is a Kanan reporting rule.
- Practice Mocks contain three skills only; label their overall as a three-skill practice band, without implying an offline Speaking requirement.
- If Listening, Reading, or Writing is unavailable, overall is pending. Never substitute zero, silently average fewer than three, or expose incomplete AI results as final.
- Store raw values, conversion table version, criteria, skill bands, unrounded mean, and rounded overall for reproducibility.

### FLT result lifecycle and release

Track independent objective, AI, Trainer-review, Speaking, Admin-review, and publication states; one status must not erase another. The expected progression is Submitted -> Auto Scored -> AI Pending/Completed (or Failed) -> Trainer Review -> Admin Review/Ready for Release -> Released. Speaking Marks Pending may coexist with any post-submission stage.

Admin can release one result, selected results, completed results for an FLT, or completed results for a course. Default release requires complete Listening/Reading/Writing evaluation. Speaking may still be pending: release the explicitly labelled three-skill result. When Speaking is later entered, update the released result and notify the student. Trainer cannot release results.

Release sends an in-app notification linking to the result. Later score changes retain an audit trail and update the final approved score. A62 mentions an intentional Admin override for other incomplete releases, while A65 prohibits incomplete results after AI failure; the exact exceptional policy is unresolved. Default behavior must block incomplete Listening/Reading/Writing release until resolved.

## Trainer portal and assignments (A23-A27, A64, A67-A69)

Provide login, dashboard, student list/profile, evaluation queue/marksheet, notifications, and Trainer profile. Dashboard shows assigned students, own pending/completed evaluations, Writing pending, Speaking pending, recent evaluations and students needing attention. Student and queue views have My assigned students / All students plus search, course, status and assigned-Trainer filters.

The student academic profile includes identity/course/access status, practice progress, attempt history, scores, AI evaluations, feedback, and score revisions without contacts or account editing. Queue rows show student/test/course/submission date, AI/review/Speaking states, and current reviewer. Workload counts actual completed evaluations even for students assigned elsewhere.

Admin assigns one or many students to a Trainer individually or via CSV/XLSX. New submissions route to the new Trainer after reassignment; pending work may be moved explicitly. Historical reviewers/revisions remain unchanged. Bulk assignment requires upload, preview, validation, confirmation, and success/failed-row summary. Validate existing student/trainer IDs, required fields, duplicate rows/assignments, and course mismatches. Show row numbers and correction reasons; provide a downloadable error report. Bulk student creation is not included without a later scope decision.

## Admin, content, and operations (A34-A50, A71)

Admin dashboard includes account/course counts, trainers and students per Trainer, evaluation backlog/completions, unlocked FLTs, recent attempts/results, pending releases and expiring students. Trainer management includes create/edit, enable/disable, credential reset, assignment, workload and activity.

Question Bank covers Listening/Reading/Writing plus offline-only Speaking. Require course eligibility, module, question type, section, difficulty, publication/status, and search/filter metadata. Support authoring, edit, preview, duplicate, publish/unpublish and archive/delete with historical attempt integrity. Listening uses audio/options/keys; Reading uses passages/questions/keys; Writing uses course-appropriate tasks, instructions, word targets and images/charts; Speaking uses parts, cue cards, topics and timing for offline staff use.

Test Builder handles FLTs and Practice Mocks separately: select/add/remove/reorder questions, configure sections/durations, draft, preview, publish and unpublish. Do not deliver Speaking as an online section. General/Academic tabs each separate the two test types. Only FLTs have availability toggles. Publishing a Practice Mock makes it available to eligible active students; publishing an FLT never unlocks it automatically. Display type/number, publication, availability where applicable, attempts and completion counts.

Client-supplied questions, answer keys and test structures need agreed CSV/Excel templates and import tools. Content writing/recording and routine content entry are not development deliverables unless separately agreed.

Required in-app notifications cover releases, FLT unlocks, feedback, Speaking marks, evaluation changes, announcements, access expiry, Trainer assignments/backlog, failed imports, workload and Admin release tasks. No email/SMS/WhatsApp integration is included.

Reports cover student/course/test/module/question-type performance, General versus Academic, Practice Mock versus FLT, average band, attempts/completion, access status/expiry, Trainer workload and turnaround. Filters include dates, course, test, Trainer, student and module. Management lists require search, filtering, sorting and pagination. Do not invent measured production analytics from fixtures.

Audit important account, credential, assignment, content, availability, score, conversion-table, release, interruption/resume and excessive-interruption actions. Record actor, target, time, appropriate old/new values and remarks without secrets or unnecessary personal data.

Operational settings include institution/support details, notification/evaluation preferences, default access duration, file limits, conversion tables and interruption review limit. Fixed rules such as no student self-reset, no digital Speaking, and no individual extra attempts are not settings toggles.

## Design, reliability, and delivery

Preserve Stitch as visual authority and follow DESIGN_SYSTEM.md. Keep minimal text, clear status badges, keyboard access, focus/labels, semantic buttons, accessible modals, icon-preserving desktop sidebar collapse and mobile drawer navigation. Validate at 1440, 1280, 1024, 768, 430 and 390 px, including all test theme/font settings. Support current desktop/mobile Chrome, Edge, Safari and Firefox as the target browser matrix, subject to runtime verification.

Production requires a backend, PostgreSQL, protected object storage for Listening audio and task images, real authentication/authorization, durable autosave, idempotent submission, secure AI evaluation/retry, monitoring and backups. No Speaking recordings are collected. Exact performance/concurrency, retention, recovery and hosting targets remain to be agreed.

The SOW delivery phases are discovery/design; core platform; practice/tests; evaluation/results; Admin/reports/notifications; testing/UAT; deployment/handover. Admin/Trainer/deployment guides are written. Staff training, client staging review, production hosting setup and operational handover remain launch activities. Do not infer completed UAT, approval, warranty dates, training counts or commercial acceptance from blank placeholders in the source document.

## Acceptance scenarios

1. Active students access published practice/Practice Mocks only for their single course; FLT availability is independently course-level and publication-gated.
2. Exactly 40 FLTs exist per course. No UI/API/data model grants individual FLT permission or extra attempts.
3. Backend start transactions enforce two Practice Mock attempts and one FLT attempt even under simultaneous requests; resume preserves the same attempt.
4. Speaking routes cannot record/submit; offline content is staff-only; saved Speaking criteria/date/remarks recalculate the correct band.
5. Unreleased FLT scores/feedback cannot be retrieved by students through any summary, direct URL or request. Practice scores need no release.
6. Eligible three-skill FLT results can be released with Speaking pending, then updated/notified after offline marks; missing Writing cannot masquerade as a three-skill result.
7. Any Trainer may evaluate any student; assignment filters never become authorization. Trainer responses/exports contain no contacts, credentials, or account mutation rights.
8. Every score change requires remarks and preserves original/previous values, actor and timestamp. Concurrent reviewers are identified and conflicting saves handled.
9. Each interruption preserves acknowledged answers and remaining time; disconnected time is not deducted; the fourth interruption flags a default-limit attempt. Device-clock changes and resume cannot reset time.
10. Listening speed options exist only in module practice, default to 1x, and never appear in Practice Mocks/FLTs.
11. Themes/fonts persist per attempt, remain confined to the test, and work at all target widths with no clipped content.
12. AI failure safely retains Writing and supports retry/manual review; release blocks incomplete Listening/Reading/Writing evaluation.
13. Imports preview/validate before mutation, identify every failed row, and preserve previous assignment/evaluation history.
14. Expired/disabled/not-yet-active users cannot reach protected content; student credentials and course/access are Admin-controlled.
15. Desktop collapsed navigation retains labelled icons; mobile drawer leaves no permanent sidebar space.

## Remaining confirmations and defaults

| Item | Current treatment |
| --- | --- |
| Practice Mock count per course | Client confirmation required; sample fixtures do not define the production catalog. |
| Final test theme names/colours | Use SOW defaults pending design confirmation. |
| Interruption review limit | Default 3; flag when count exceeds it; Admin configurable. |
| Historical student results after expiry | Not accessible by default. |
| Lower raw-score conversion rows | Admin must supply complete valid tables before production scoring. |
| Exact section durations/content/audio rules | Configure from approved client test content; no invented exam policy. |
| Heartbeat timing, concurrent sessions, mid-attempt changes | Implemented defaults: 3-second signals, 7.5-second tolerance, sequence conflicts, immutable snapshots and current access checks; validate on the selected host. |
| Dates and course history | Inclusive Asia/Kolkata calendar dates; historical original-course records remain staff-accessible. |
| Ranking/progress/review | Replaceable defaults are recorded below; latest Practice Mock attempt, available scored records and released-only FLTs. |
| Incomplete-result release exception | Block incomplete L/R/W by default; reconcile A62 with A65 before an override is offered. |
| Providers and hosting | User-approved replaceable defaults: PostgreSQL, S3-compatible storage, OpenAI Writing adapter. Real credentials, institution retention/load targets and hosting are launch inputs. |
| Commercial/UAT/warranty/training placeholders | Not completed or accepted by this repository update. |

Excluded: digital Speaking, native apps, payments, self-registration/password reset, webcam proctoring/browser lockdown, certificates, multi-branch/batch/parent reporting, AI tutor/personalized recommendations, external messaging, manual test pause, individual unlock credits/extra attempts, and speed controls in full tests.

## Implemented operational decisions (full-project task)

The user authorized full implementation using replaceable defaults on 27 October 2026. The default stack is Node 24/TypeScript/Fastify, Prisma 7/PostgreSQL, private S3-compatible storage and an optional OpenAI Responses Writing adapter. Keys, provider endpoints/model and database URL stay server-side and configurable.

Access dates are inclusive calendar dates in Asia/Kolkata. Every request reloads account/role/access state. Course/status/date changes and password resets revoke old sessions. Existing attempts keep immutable course/content/conversion snapshots; changing publication/availability after start does not destroy an already-started attempt, while current account/access/course restrictions still apply. Historical results from a previous course remain stored for staff but are not exposed through the student's newly assigned course.

The client sends an acknowledged revision every three seconds. The server deducts time only between confirmed signals within a 7.5-second continuity window; server-observed stale gaps stop charging and log an interruption/resume. A client reconnect claim does not establish a disconnection or waive a continuous server interval. Gaps within the tolerance are treated as continuity, including short network/visibility transitions: HTTP heartbeats cannot establish exact disconnection boundaries inside that window. Section time is stored separately. New/changed answers are accepted only for the server's active skill; the browser waits for acknowledgement before editing another skill. Duplicate sequences are idempotent; stale/out-of-order concurrent writes are rejected. This requires production network/outage and load testing before go-live.

Imports use preview/confirmation and partial success: valid rows commit in one transaction, invalid rows remain reported, and confirming the same batch twice does not repeat assignments. CSV/XLSX assignment, question and test-structure imports are implemented; content imports as drafts. Test structures are assembled in the builder. Test structures can also be imported as drafts through CSV/XLSX with version and eligibility validation.

Leaderboard is disabled initially. If enabled, the current implementation averages available released FLT and completed Practice Mock bands, using each student's latest attempt per test, with rolling 7-/30-day windows and public display-name ordering for ties. Confirm institution ranking policy before enabling it. Dashboard progress shows actual assessment counts and latest available bands; it does not invent a syllabus completion percentage.

Production gates: provide licensed complete assessment content, Listening audio/task images, full raw conversion tables, hosting/TLS and provider credentials; validate external services, backups/restore, operational monitoring, load/concurrency and client UAT. No public deployment or paid AI call was performed during local implementation.

## Content deferral and application completion

The user explicitly deferred real assessment papers, questions, audio and other media. Catalog population, publication of real papers and lower conversion values supplied by the institution are separate from application development. Keep the real catalog empty/draft until content is uploaded; automated checks use isolated fixtures only.

The connected application includes dedicated academic reports/CSV export, operational interruption review, private media reuse, Admin announcements, complete operational preference controls, explicit pending-work reassignment, section submission/closed-section recovery, passage/question navigation, module-only manual review and stored AI feedback/strengths/weaknesses/corrections/improvement suggestions. Bulk release supports selected results, a test or an entire course, preserving the L/R/W completion rule. No excluded features are introduced.

See docs/IMPLEMENTATION_STATUS.md and docs/VERIFICATION.md for implemented scope and the distinction between application verification and external go-live work.

## Subsequent practice-content task

The user subsequently requested official-paper sourcing and practice additions. Official partner sample pages were researched; the external resource links have since been removed from the portal at the user?s request. No full official paper/audio has been republished or represented as one of the portal FLTs. The public source terms restrict republication; no source-specific licensed files or approved inventory were supplied.

An original, clearly labelled pack adds 24 Reading questions, 8 Writing tasks and 8 Listening drafts with a recording script. Its explicit Admin-audited installer preserves existing IDs/staff edits, keeps records unpublished and never modifies tests, attempts or results. Reading/Writing need staff review before publication; Listening also needs an actual private audio asset. This supersedes the earlier blanket practice-content deferral while preserving the unfinished official-FLT content boundary. See backend/content/README.md.
