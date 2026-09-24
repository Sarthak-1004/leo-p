# Architecture — Initial / Provisional

## Status

The Stitch source code has **not** been inspected. This document describes intended production boundaries, not an implemented system, database schema, or final technology selection.

**Frontend technology: To be confirmed after Stitch code audit.**

Do not assume React, Next.js, Vite, or any other frontend framework. Backend framework/runtime, API conventions, authentication mechanism, hosting, package manager, and repository layout also remain unresolved. No application code, API routes, database schema, Prisma initialization, or infrastructure is authorized by this documentation task.

## Intended production flow

```text
Frontend
    |
Backend API
    |
Application / Service Layer
    |
Prisma ORM
    |
PostgreSQL

Application / Service Layer --> Object Storage
                               (audio, recordings, assessment media)
```

The frontend presents the audited Stitch interface and communicates with authorized backend operations. The API validates requests and authenticated identity; application services enforce business rules and coordinate persistence. Prisma is the intended ORM and real PostgreSQL is the required production persistence layer. These are conceptual layers, not a requirement for separate deployments or microservices.

Use object storage for Listening audio, Speaking recordings, and other assessment media. Store metadata and authorized references in PostgreSQL rather than large media binaries. Storage provider, formats, upload limits, retention, and delivery strategy remain to be chosen.

In-memory or mock data may support future explicitly authorized prototypes/tests, but must never become production persistence. Prefer a simple maintainable deployment with clear domain boundaries suited initially to hundreds of students.

## Future domains

| Domain | Responsibility |
| --- | --- |
| Authentication | Student ID/password authentication, Admin authentication, session lifecycle, secure password hashing, and Admin-controlled student credential resets. |
| Students | Student identity, account status, access dates, and exactly one course assignment. |
| Courses | General and Academic course identities and content eligibility. |
| Authorization | Roles, ownership, course scope, account/access validity, publication, and availability checks. |
| Question Bank | Module content, prompts, passages, answer keys, media references, eligibility, and publication lifecycle. |
| Practice | Authorized practice delivery and module-specific submission flows without Admin unlocks. |
| Mock Tests | Two course catalogs of 40 tests, section composition, instructions, and publication. |
| Course-level Mock Availability | Independent availability for each course/test pair, applied to all active students in that course. |
| Attempts | Attempt lifecycle, course/test context, timing, transitions, submission, and approved resume behavior. |
| Answers | Durable attempt-linked responses, save acknowledgment, and safe retry/concurrency behavior. |
| Results | Objective scoring where applicable, evaluation status, approved band calculations, and private result access. |
| Progress | Defined summaries derived from authorized attempts/results. |
| Leaderboard | Optional course-separated rankings with minimal approved public fields. |
| File Storage | Protected uploads/downloads, media metadata, validation, and retention. |
| Admin | Administrative orchestration for students, content, access, reports, and settings. |
| Audit logs | Traceable administrative changes and relevant security events without passwords, secrets, or unnecessary answer/recording content. |

## Access model

A Student has exactly one assigned IELTS course. An Admin manages students, content, and access. Shared question eligibility does not grant students access to the other course's portal or mocks.

Mock availability must conceptually be represented as:

```text
COURSE + MOCK TEST + AVAILABILITY
```

There must never be a `STUDENT + MOCK TEST PERMISSION` model, individual allowlist, per-student override, or equivalent UI/API. Student-linked attempts and results record assessment activity; they do not confer access permissions.

The eventual data model must ensure one unambiguous availability state per eligible course/test pair and prevent cross-course ambiguity between similarly numbered mocks. General and Academic availability must remain independent.

### Authorization decisions

| Operation | Required checks |
| --- | --- |
| Access protected student functionality | Authenticated Student, enabled account, and valid access period. |
| Read/start/submit practice | Active student access, assigned-course eligibility, and applicable publication/lifecycle checks; no mock unlock requirement. |
| Start a mock | Active access, correct course, published eligible mock, and course-level availability ON. |
| Save/resume/submit an attempt | Attempt ownership and course context, authoritative attempt state/time, and approved access-change policy. |
| Read private results/recordings | Authorized Admin or owning Student with required current access and applicable course/history policy. |
| Manage students/content/availability | Authorized Admin; validate input and audit sensitive changes. |
| Read leaderboard | Feature enabled, authorized scope, and only approved ranking fields. |

Enforce these checks server-side, including on direct identifier-based requests and media access. Frontend locks are explanatory UI only. Do not expose answer keys in assessment payloads before an approved review stage. Changing account status, course, or dates must not leave stale session claims granting continued unauthorized access.

## Assessment integrity and durable state

Future services must preserve acknowledged answers, enforce time on the server, make final submission safe to retry, and reject invalid lifecycle transitions. Finalized results must remain associated with the actual assessment/course context and interpretable after content edits.

Choose versioning/snapshot strategy, transaction boundaries, autosave cadence, conflict handling, and recovery rules during implementation design. Resolve mid-attempt toggle changes, expiry, disablement, course reassignment, and publication changes explicitly before implementation. A resume mechanism must not become a way to reset examination time.

Writing and Speaking require submission support with explicit evaluation status. Future manual/AI evaluation should fit behind the Results domain; no model vendor or automatic grading service is chosen here.

## Security and operations

- Hash student and Admin passwords using a suitable password-hashing implementation selected during technical design; never persist plaintext credentials.
- Keep secrets server-side and outside committed .env files. Do not expose privileged storage or database credentials in frontend assets.
- Select secure session handling, transport protections, request validation, authentication abuse controls, and browser protections appropriate to the audited stack.
- Authorize media uploads and reads, validate file size/type, and use controlled storage access rather than public recording URLs.
- Audit student credential resets, course/date/status changes, publication changes, and mock availability changes with actor, target, time, and appropriate change details.
- Plan PostgreSQL backups and restore verification, media lifecycle management, error monitoring, and operational access controls before production deployment.
- Define retention/deletion policies for student data, answers, recordings, and audit events before launch.

## Verification plan for future implementation

Test course isolation, result ownership, expired/disabled/not-yet-active accounts, independent course availability, publication versus availability, and absence of student-specific unlocks. Verify durable save/retry behavior, timer enforcement, and approved attempt lifecycle policies. Include accessible responsive UI checks against Stitch and integration tests using real PostgreSQL for persistence-sensitive behavior.

## Required update after Stitch audit

After both ZIP files are supplied and import is authorized, inspect their actual source before selecting technologies. Inventory screens, assets, dependencies, framework/build evidence, existing conventions, reusable components, and incomplete interactions. Do not assume the two exports use identical technology.

**Update ARCHITECTURE.md after both Stitch ZIP files are audited.** Record the confirmed frontend, backend decisions, repository structure, API boundaries, authentication, media strategy, deployment plan, setup/test commands, and any gaps against PRD.md. Reconcile DESIGN_SYSTEM.md and README.md with those decisions. Keep unresolved policies visible rather than implementing accidental defaults.
