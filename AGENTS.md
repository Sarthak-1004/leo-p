# Instructions for future Codex sessions

## Read first

- Read PRD.md before changing product functionality.
- Read DESIGN_SYSTEM.md before modifying UI.
- Read ARCHITECTURE.md before major technical or infrastructure changes.
- Keep these documents consistent when an approved decision changes.
- Current requirements follow SOW-KANAN-IELTS-001 v1.0 dated 20 October 2026. STITCH_AUDIT.md is historical; later PRD decisions supersede its old scope assumptions.

## Current stage

- The connected React/TypeScript/Vite frontend and Fastify/PostgreSQL backend are implemented. The optional fixture preview is isolated from live mode.
- The subsequent full-project task authorizes backend, PostgreSQL, authentication, storage/AI adapters, frontend integration and deployment preparation. Keep live deployment and external paid calls separate until the required accounts/configuration exist.
- The later content task authorizes practice additions. An original 40-question review pack is in backend/content and is installed explicitly as unpublished drafts. External official-resource links were removed at the user?s request; source-specific licensed papers/audio are still needed for official FLT import. Do not fill the 104 FLT slots with copied/unlicensed or mislabelled sample papers.
- Preserve the existing scaffold and use actual package.json commands; do not re-scaffold or invent tooling/setup instructions.
- Connected API mode is the default. VITE_DEMO_MODE=true explicitly enables the isolated fixture preview. Demo data resets on reload; live data uses real PostgreSQL. Never fall back to fixtures when an API call fails.
- Backend stack: Node 24, TypeScript, Fastify 5, Prisma 7 and PostgreSQL. Use actual package scripts. Generated Prisma code, node_modules, local/test clusters and .env files remain ignored.
- Use DB-backed authorization, optimistic revisions and transactional start/submit/release operations. Keep immutable audit/score records and attempt snapshots.
- Preserve original Stitch archives and the historical audit. Do not alter unrelated working files.

## Product rules

- Three roles: Student, Trainer (Teacher), Admin. One Admin role type.
- Each student belongs to exactly one course: General or Academic. Admin controls course, credentials, account status and access dates.
- Students cannot self-register or reset/change their passwords. Fixed prohibitions must not become settings toggles.
- Module practice and published Practice Mock Tests need no Admin unlock during active access.
- FLT questions stay separate from all practice material: never reuse a question across an FLT and a Practice Mock Test or module practice (client decision 20 Nov 2026; enforced in saveTest and saveQuestion). Student menu: Tests (Learning Arena with Question Specific and Sectional, and Module Arena = Practice Mock Tests); Full Length Tests is its own tab outside Tests (client decision 21 Nov 2026).
- Practice Mocks allow 2 attempts per test. FLTs allow 1 and have exactly 52 tests per course (client decision 16 Nov 2026; previously 40). Count at start; resume is the same attempt. Practice Mocks have no fixed count (client decision 17 Nov 2026): Admin publishes as many as wanted and they are open without unlock. FLTs open only when Admin turns on course availability.
- FLT availability is course-level and independent between General and Academic. Keep publication separate. Never add individual permissions, credits or extra-attempt grants.
- Speaking (client decision 21 Nov 2026): enabled in all practice (Learning Arena and Practice Mock Tests) with a speaker/microphone check, browser-recorded WAV answers stored privately under recordings/<student>/<attempt>/, and Gemini marking (transcript, four whole-number criteria, half-band Speaking score, highlighted corrections); trainers do not re-check practice. In a Practice Mock, Speaking is an optional fourth section after Writing (up to 12 questions, its own time); recordings are accepted only while it is open, Writing and Speaking are separate AI jobs, and the result shows once both are marked. FLT Speaking stays offline: FLTs cannot have an online Speaking section and refuse recordings (enforced on the server), trainers enter offline marks.
- Listening speed 1x/1.5x/2x exists only in module practice; reset to 1x per new attempt. No speed controls in Practice Mocks or FLTs. There, Listening audio plays once (client decision 17 Nov 2026): a start screen with Play, no pause/rewind/seek controls, and the server keeps the furthest audio position so a reload continues instead of replaying. Volume is the only control.
- FLT scores/feedback require Admin release, including in summaries/history/direct URLs. Practice results need no release after scoring.
- FLTs can be released with Speaking pending when L/R/W are complete; label Overall (3 skills) - Speaking pending. Recalculate/notify after Speaking is entered. Do not treat missing L/R/W as zero.
- Trainer assignment routes workload, not access. Any Trainer can evaluate any student's academic record, but cannot manage accounts/access or release results.
- Every changed Trainer/Admin score requires remarks and preserved previous/original values, actor and timestamp. Speaking criteria are whole numbers 0-9; apply PRD half-band calculation rules.
- Low raw-score conversions follow the client decision of 16 Nov 2026: below the official IELTS rows, Listening/Academic Reading use 8-9 3.5, 6-7 3.0, 4-5 2.5, 3 2.0, 1-2 1.0, 0 0; General Reading uses 6-8 2.5, 3-5 2.0, 1-2 1.0, 0 0. These are the common prep-provider extension, not official IELTS figures. Do not invent any other values; Admin may still edit per-test tables.
- Timers count only server-confirmed connected time; interruptions stop time and resume restores it. No manual Pause. Flag when interruptions exceed the default/configured limit of 3.
- Test theme/font settings apply only to Practice Mocks/FLTs, persist with the attempt and must survive resume.

## Security and persistence

- Enforce role, course, account status, dates, ownership, publication, availability, attempt limits and release on the server. Frontend hiding is insufficient.
- Strip student contact details from all Trainer responses, search, reports and exports at the backend. Trainer views must never fetch and merely hide contacts.
- Hash passwords securely. Never commit .env files or expose secrets/plaintext credentials in frontend code or logs.
- The later 28 October user decision requires email/assigned ID plus password for every role. Do not restore authenticator enrollment, verification, QR/recovery codes or a factor requirement. Sensitive staff changes use password-only confirmation. Accounts remain Admin-managed; no public signup or Student self-registration/reset.
- MFA schema/migration fields and existing deployment keys are retired compatibility data, not authentication requirements. Preserve existing keys and records for rollback; do not regenerate or drop them. Encrypted-backup procedures remain in docs/SECURITY_OPERATIONS.md, and restore checks must never overwrite live data.
- Production persistence must use real PostgreSQL. In-memory/mock/browser persistence must never become production persistence.
- Protect media and answer keys; store permitted audio/images in object storage. Speaking recordings are collected only in practice (module practice and Practice Mocks) and stay private to the student and staff.
- Do not promise completed AI/audio/XLSX/import/heartbeat integrations when only preview behavior exists.

## UI and verification

- Supplied Google Stitch designs remain the primary visual source of truth. Extend existing patterns for Trainer/new flows; do not redesign supplied pages unnecessarily.
- Keep interface text minimal, with truthful save/evaluation/pending/release feedback.
- Preserve collapsible desktop sidebar icons, accessible labels/tooltips and active-page indication.
- On mobile use hamburger navigation and a drawer, with no permanent desktop sidebar space.
- Validate at 1440, 1280, 1024, 768, 430 and 390 px, including the three test themes and three font sizes.
- Prefer reusable components and existing conventions; avoid unnecessary architecture complexity.
- Run relevant checks after feature work and report results and verification limitations.
