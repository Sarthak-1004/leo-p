# Kanan IELTS Practice Portal — Product Requirements

## Status and scope

This document defines the product requirements for the Kanan IELTS Practice Portal. The repository is at the planning/documentation stage. UI designs are complete externally in Google Stitch; two source ZIP files await import and audit. Application, backend, and database implementation have not started.

The current task covers documentation only. Future implementation must follow this document and the supplied Stitch designs. Frontend technology, technical setup, and unresolved assessment policies must be confirmed later.

## Purpose and users

Provide Kanan students with a focused portal for IELTS General Training and IELTS Academic preparation, and provide non-technical Kanan staff with tools to manage students, content, assessments, and results.

| Role | Responsibilities and access |
| --- | --- |
| Student | Practise, take available mock tests, and view personal progress and results within the assigned course and access period. |
| Admin | Manage student credentials, course assignments, access periods, content, mock availability, and reporting. |

## Non-negotiable business rules

1. Every student belongs to exactly one course: **IELTS GENERAL** or **IELTS ACADEMIC**. There is no dual enrollment.
2. Students may access only their assigned course's content. The other course may appear greyed out or locked where appropriate.
3. Course, account, access-period, ownership, and role restrictions must eventually be enforced by the backend on every protected operation; visual hiding is insufficient.
4. Practice is available throughout active portal access. Admin does not unlock individual practice tests. Content publication is a separate editorial concern.
5. There are 40 General mock tests and 40 Academic mock tests. Each course has an independent availability setting for each test.
6. Mock availability is course-level, never student-specific. No individual student mock permissions, exceptions, or unlock controls may exist.
7. Mock publication and mock availability are separate concepts. A test being ON does not make unpublished content accessible.
8. Students receive a Student ID and password from the Kanan office. There is no student self-registration, password change, or forgot-password flow. Only Admin creates or resets student credentials.
9. Expired access blocks protected portal functionality. Disabled accounts cannot use protected functionality.
10. Private results are accessible only to their owner and authorized Admin users. A leaderboard, if enabled, exposes only its approved limited ranking information.

## Student account and access lifecycle

Each student has a Student ID, name, one assigned course, start date, expiry date, account status, and securely hashed password credentials. Admin can create and edit the account, change the course assignment, set dates, enable/disable access, reset the password, and view progress/results.

Active portal access requires an enabled account and a currently valid access period. Exact timezone and date-boundary semantics must be confirmed before implementation. Before-start, expired, disabled, and wrong-course access need clear outcomes with short guidance to contact the Kanan office where appropriate.

Course changes must update authorization consistently. Handling of historical results and attempts in progress after a course change remains a policy decision; no history should be silently reassigned to the new course.

Passwords must eventually be securely hashed. Plaintext passwords must not appear in persistent records, application logs, reports, or frontend code. Credential delivery procedures and Admin authentication/recovery policy remain to be defined.

## Student pages and requirements

| Page or state | Required behavior |
| --- | --- |
| Student Login | Accept office-issued Student ID and password; provide concise authentication errors without self-registration or password recovery links. |
| Dashboard | Show student name, assigned course, access expiry, Listening/Reading/Writing/Speaking progress, recent results, and available/completed mock tests with minimal text. |
| Practice | Provide access to the four practice modules for the assigned course while access is active. |
| Listening Practice | Audio playback, questions, question navigation, answer submission, and objective scoring where applicable. |
| Reading Practice | Reading passage, questions, question navigation, answer submission, and objective scoring where applicable. |
| Writing Practice | Task 1 and Task 2 prompts, writing editor, word count, and submission. Allow future manual/AI evaluation. |
| Speaking Practice | Parts 1–3, cue cards, recording, and submission. Allow future manual/AI evaluation. |
| Mock Tests | List assigned-course mock tests with clear availability and completion states; show locked tests appropriately. |
| Mock Test Instructions | Present configured sections, timing, navigation/submission rules, and recording requirements before starting. |
| Full Mock Test Interface | Timer, questions, navigation, saving, section transitions, submission, and recovery/resume where appropriate. |
| Mock Test Result | Show the submitted test's available scores and evaluation status. |
| Test History | List the student's attempts and allow access to authorized result detail. |
| Detailed Result | Show available assessment details, section scores, and evaluation status for the student's own attempt. Answer-review release policy is unresolved. |
| Leaderboard | If enabled, support weekly, monthly, and overall rankings separated appropriately by course. |
| Profile | Show account information and assigned course/access dates. Student-editable fields are unresolved; credentials and enrollment remain Admin-controlled. |
| Locked Course State | Clearly identify unavailable course access without exposing protected content. |
| Expired Access State | Explain that access has ended and direct the student to the office; block protected actions. |

### Practice behavior

Published, course-eligible practice content is accessible during active portal access without mock availability toggles or student-specific unlocks. Questions may be eligible for both courses, but delivery must occur within an authorized course context.

Listening and Reading scoring uses configured answer keys where applicable. Writing and Speaking submission does not imply immediate evaluation. Pending or unavailable scores must be distinct from a score of zero. Manual and AI evaluation are future capabilities, not promised initial automated grading.

Speaking must handle microphone permission denial, recording failure, upload failure, and successful submission clearly. Audio and recording controls must be accessible and usable on supported mobile devices. Supported formats and browser requirements remain unresolved.

### Mock tests and availability

Each course has 40 numbered mock tests. Admin views and controls the two catalogs independently.

| Course | Mock 01 | Mock 02 | Effect |
| --- | --- | --- | --- |
| IELTS GENERAL | ON | OFF | All active General students can access published Mock 01; Mock 02 is locked. |
| IELTS ACADEMIC | OFF | ON | All active Academic students can access published Mock 02; Mock 01 is locked. |

ON means available to all active students assigned to that course, subject to publication and valid content. OFF means locked for all students in that course. Neither setting overrides account expiry, disabled status, or course restrictions.

Mocks must support a realistic IELTS examination experience. Potential sections are Listening, Reading, Writing, and Speaking. Section inclusion, order, timing, permitted navigation, audio replay, attempt limits, and scoring rules must be confirmed before implementation rather than inferred from screen designs.

The interface must distinguish saving, saved, unsaved/error, submitted, and evaluation states. Future implementation must prevent duplicate final submissions, preserve acknowledged answers, and keep timer enforcement authoritative on the server. Recovery must not silently extend allowed time. Policy for availability changes, expiry, or course reassignment during an attempt remains unresolved and must be defined before that behavior is built.

## Admin portal

| Page | Required capability |
| --- | --- |
| Admin Login | Authenticate authorized staff separately from student access. |
| Admin Dashboard | Provide concise operational summaries and navigation to management tasks; exact metrics await design audit. |
| Student Management | Create, view, search/manage, and edit students; enable/disable accounts. |
| Student Details | View identity, enrollment, access dates, progress/results, and credential-reset actions. |
| Course Assignment | Assign or change the student's single General/Academic enrollment. |
| Question Bank | Manage questions across all four modules and course eligibility. |
| Create Question | Author module-specific content and associated media. |
| Edit Question | Update and preview content with publication controls. |
| Mock Test Management | Show independent General and Academic sections, each with 40 tests and course-level ON/OFF toggles. |
| Mock Test Builder | Assemble section/question content and manage publication separately from availability. |
| Results | View student attempts, available scores, and evaluation status. |
| Reports | Access student result/progress reports; exact filters and export scope await definition. |
| Settings | Manage approved administrative settings; exact scope awaits design and policy confirmation. |

### Question Bank

Questions can belong to General, Academic, or both where appropriate. Admin needs create, edit, preview, duplicate, publish/unpublish, search, and filter operations. Course eligibility and publication must be visible and validated when content is assembled or delivered.

| Module | Content support |
| --- | --- |
| Listening | Questions, answer keys where applicable, and audio. |
| Reading | Passages, associated questions, and answer keys where applicable. |
| Writing | Task 1 and Task 2 prompts and relevant assessment media. |
| Speaking | Parts 1, 2, and 3 prompts and cue cards. |

Question types, validation rules, content versioning, and the effect of edits/unpublishing on existing attempts need confirmation. Historical results must remain interpretable after editorial changes.

## Results and progress

Results can include test name, date, time taken, Listening score/band, Reading score/band, Writing score/band, Speaking score/band, and overall band. Only applicable and available values should be displayed. Do not invent band conversions or calculate a misleading overall band from incomplete evaluation.

Score conversion tables, rounding, overall-band eligibility, manual evaluation workflow, and result-release policy are unresolved. Progress definitions and the treatment of repeat attempts must be documented before dashboard metrics are implemented.

## Leaderboard

Leaderboard availability is optional. If enabled, provide weekly, monthly, and overall views with appropriately separate General and Academic rankings. Expose only necessary display identity and ranking information, never credentials, access dates, private answer details, or unnecessary personal data. Ranking formula, eligible attempts, ties, time boundaries, display identity, and privacy/participation policy must be defined before release.

## Non-functional requirements

- **Responsive:** Intentional layouts around 1440, 1280, 1024, 768, 430, and 390 px, following DESIGN_SYSTEM.md and Stitch references.
- **Usable:** Clean, minimal, professional screens with clear statuses and straightforward workflows for non-technical staff.
- **Accessible:** Keyboard-operable controls, visible focus, semantic labels, adequate contrast, and statuses that do not rely on color alone.
- **Fast:** Responsive navigation and assessment interactions, efficient lists, and appropriate media delivery. Quantified performance budgets await technical audit.
- **Reliable:** Observable answer-saving states, protected submissions, defined recovery behavior, and durable production persistence.
- **Secure:** Server-side authorization, secure credential handling, protected media, private results, and audited administrative changes.
- **Maintainable:** Reusable components and clear domain boundaries; avoid unnecessary infrastructure complexity.
- **Scalable:** Initially support hundreds of students. Concurrency, media volume, and load-test targets must be confirmed before production rollout.

## Acceptance scenarios for future implementation

1. An active General student can access eligible General practice without an Admin unlock and cannot retrieve Academic-only content through direct requests.
2. Switching General Mock 06 ON makes the published test accessible to all active General students; switching it OFF locks it for that course. Academic availability is unaffected.
3. No UI, API, or persistence model provides individual-student mock unlocks.
4. An unpublished mock remains unavailable even when its availability is ON.
5. An expired, disabled, or not-yet-active account cannot use protected portal functionality through either the UI or direct backend requests.
6. A student cannot retrieve another student's private attempts, answers, results, or recordings by changing identifiers.
7. Students have no registration, password change, or password reset pathway; Admin can issue/reset credentials securely.
8. Dashboard and results distinguish incomplete evaluation from zero scores and calculate only approved metrics.
9. Answer saving, submission, timer enforcement, and recovery follow the approved attempt policy, including network interruption handling.
10. Sidebar icons remain visible when collapsed, and mobile navigation uses a drawer without a permanent desktop sidebar.

## Decisions intentionally deferred

Audit the two Stitch ZIP files before choosing frontend technology or setup commands. Also confirm assessment composition/timing/scoring, repeat attempts, recovery rules, mid-attempt access changes, date boundaries, course-change history, result review/release, progress and ranking formulas, evaluation workflows, content lifecycle, media retention, Admin roles/settings, deployment, and measurable operational targets. Record decisions in the relevant source-of-truth documents before implementing dependent functionality.
