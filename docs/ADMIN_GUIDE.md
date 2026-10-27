# Admin guide

## Initial setup

Follow the root README to start PostgreSQL, migrate and run `npm run setup` in `backend/`. The setup command asks for an initial Admin ID/password in your terminal and stores only a password hash. There are no default production credentials. Then open `/admin/login`.

## Accounts and access

Use Students to create an account with one General or Academic course, inclusive start/expiry dates, account status and an initial password of at least 12 characters. Contacts are available only to Admin. Distribute credentials through your office's approved process.

Edit an account to change enrollment/access or assign a Trainer. Disabling access, changing enrollment/dates or resetting a password invalidates earlier sessions. Previous attempts retain their original course/content history. Students cannot self-register, extend access or reset passwords.

Trainer management supports creating/editing accounts, enable/disable, password reset and student assignments. New submissions follow the current assignment. Existing pending work keeps its routed Trainer unless you select Move pending evaluations, or set Move Pending=true in an import. Historical reviewers and scores are preserved. Assignments route queues/workload; every enabled Trainer can review every student's academic record without contacts.

## Bulk assignment and content import

Download a CSV template. Assignment headers are Student ID, Teacher ID and Course (GENERAL/ACADEMIC), plus optional Move Pending (true/false). CSV and XLSX files are accepted. Upload the file, inspect each validation outcome and confirm. Only valid rows commit; invalid rows remain visible in the error report. Reconfirming a batch does not repeat it.

Content import accepts question metadata and JSON-formatted options/answer/asset IDs. Imported questions begin as drafts. Client content must be licensed and supplied in the documented format; the portal does not generate IELTS question content.

## Questions and tests

Create questions with module, course eligibility, question type, section, difficulty, prompt and answer key. Reading includes a passage. Upload Listening audio or task images to the configured private S3 bucket through the editor. Speaking questions are for staff/offline use only.

There are 40 draft FLT slots per course. Add Practice Mock drafts only for the agreed catalog. The builder selects/orders eligible published questions and sets section durations. Published full tests require 40 Listening questions, 40 Reading questions, Task 1 and Task 2, audio assets and complete conversion tables.

Fill the missing low raw-score conversions before publication. Table changes are audited and versioned; existing attempts keep the original tables. Publishing an FLT does not unlock it. General and Academic availability toggles are independent and apply to the whole course. Practice Mocks need no availability toggle. Individual credits/unlocks/extra attempts are not supported.

## Evaluation and release

Open a marksheet from Results. Automatic raw scores and available bands are stored with the attempt; Writing can be evaluated by the configured AI service or reviewed manually. A failure does not discard the essay. Retry after provider configuration is corrected, or enter a manual score with remarks.

Every changed score requires a reason. Save draft keeps proposed scores separate from approved scores. Complete review saves the approved bands and revision history. Concurrent saves require a fresh version instead of silently overwriting another reviewer.

Release one result, selected ready results, all eligible results for one FLT, or all eligible results in a course. Review and confirm the scope before release. Listening, Reading and Writing must be complete. Speaking can remain pending: students see the explicit three-skill label. Adding offline Speaking later recalculates the four-skill result and sends a notification. Trainers cannot release results.

## Operations

Notifications, audit history, account counts, assessment reports and Trainer workload derive from stored records. The interruption limit defaults to three; the fourth interruption flags review. Review flags do not grant new attempts. Leaderboard is off initially; confirm the ranking policy before enabling it.

Backups, provider credentials, media retention, monitoring, production configuration and UAT are described in DEPLOYMENT.md. Do not use the optional demo mode for real student records.

Test-structure import accepts id, course, kind (FLT/PRACTICE_MOCK), number, current version, JSON questionIds and JSON durations. Existing FLT slots are updated as drafts; imported structures never unlock a course.

## Reports, media and platform controls

Reports provides date, course, assessment type, test ID, student ID, assigned Trainer, module and question-type filters, sorting and pagination. Export CSV includes academic fields only. Performance aggregates use the latest Practice Mock attempt; raw history retains both attempts. Missing bands and unmeasured turnaround are labelled explicitly.

Media library lists uploaded private files and their IDs. Upload permitted audio/images when ready, then Choose existing media in the editor to reuse a file. Detaching it from a question does not delete media referenced by historical attempts. Import assetIds as a JSON array of file IDs. No actual content is supplied with the application.

Operations shows AI job failures/queue, integration configuration and interruption flags. Expand the connection log and Record review with remarks. Flags, original logs, attempt limits and time remain preserved. Use a marksheet to retry failed Writing or review it manually.

Notifications supports Admin announcements to enabled Students (both or one course) or Trainers, with explicit send confirmation. Mark all as read applies only to the signed-in account.

Settings controls public office/support details, default new-account access days, media size up to 20 MB, automatic Writing jobs, expiry/backlog reminders, interruption limit and leaderboard. Default access days do not rewrite existing accounts. AI turned off means manual review; required result/assignment/change notifications stay on. Provider keys stay in the server environment.
