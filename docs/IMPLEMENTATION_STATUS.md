# Portal implementation status - 27 October 2026

The connected application is implemented in the existing React frontend and Fastify/PostgreSQL backend. Real papers, question entry, audio, task images and catalog population are deferred at the user's request. The real catalog is not filled with test fixtures; first setup creates only the 40 draft FLT slots per course.

| Area | Implemented application behavior |
| --- | --- |
| Identity and accounts | Separate role logins, hashed passwords, database sessions, CSRF/origin checks, throttling, Admin-issued credentials, account editing, resets, course/access enforcement and revocation. |
| Student portal | Dashboard, practice selection, separate Practice Mock/FLT catalogs, instructions, resume, history, profile, released results/details, notifications and optional course rankings. |
| Assessment | Transactional attempt limits, immutable content/conversion snapshots, sequenced PostgreSQL autosave, safe retries, connected-time section timers, interruptions, flags, passage/question navigation, Writing task selection, section/final submission and saved display preferences. |
| Practice evaluation | Answer-key scoring, raw correctness, pending conversion states, one-prompt Writing practice, task-specific timer and module-only staff review. No invented other-skill scores. |
| Trainer portal | All-student academic access, assignment filters, evaluation queue, practice/full-test marksheets, reviewer presence, drafts, manual review, offline Speaking, original values and immutable revisions. Contacts are excluded at database selection. |
| Assignment | New submissions capture routed Trainer. Existing pending evaluations move only on explicit selection, including the optional import column. Routing never grants or restricts academic access. |
| Results | Independent AI/review/Speaking/release states, required remarks, optimistic edits, single/selected/test/course Admin release, complete L/R/W gating and three-/four-skill recalculation/notifications. |
| Question/test management | Author/edit/duplicate/archive, eligibility and key/media validation, separate catalogs, existing FLT slots, Practice Mock drafts, builder/order/duration/publication, independent availability and versioned conversion tables. |
| Media | Private S3-compatible upload and authenticated streaming/ranges, asset library, reuse/detach, file size/type validation and Writing image input. External storage credentials remain required. |
| Imports | CSV/XLSX templates, validation preview, confirmation/revalidation, valid-row commit, every failed row reported, repeat-confirmation protection and safe error CSV. Question/test structures import as drafts. |
| AI adapter | Durable leased jobs, schema/task/range validation, bounded retries, image-aware Writing inputs, stored rubric/output, strengths/weaknesses/corrections/improvements, explicit failure/manual handling and preservation of approved manual scores. Real provider credentials and quality validation remain required. |
| Reports | Server filters, sorting/pagination, latest-Practice-Mock performance, module/course/type comparisons, objective question-type accuracy, access counts, actual-reviewer workload/turnaround and academic-only CSV export. |
| Administration | Operational preferences/support details, announcements, recipient-scoped read state, interruption review retaining logs/flags, integration/job status and searchable audit history. |
| Delivery preparation | Versioned migrations, owner-run initial setup, production build/static serving, Docker/CI definitions and Admin/Trainer/deployment guides. |

See [VERIFICATION.md](VERIFICATION.md) for completed checks and their limits. Passing those checks establishes the recorded local behaviors, not a security certification or complete client acceptance.

## Intentionally outside this implementation run

- Real assessment content/media and institution-approved lower conversion values: deferred for later entry/upload. Publication stays guarded until the paper is complete.
- Live provider accounts/keys and actual S3/AI service validation: adapters are configurable and tested with deterministic/local contracts; no paid provider request was made.
- Public hosting, domain/TLS, managed production PostgreSQL, infrastructure alerts, backup retention/restoration and production load/target-browser checks: deployment and go-live operations, not silently provisioned resources.
- First production Admin credentials: set by the owner through the documented terminal setup, with no shared/default Admin password.
- Institution UAT, staff training and commercial sign-off: require the institution's participation; no acceptance is implied.

Digital Speaking, student self-registration/password reset, individual unlocks/credits/extra attempts, payments, proctoring, native apps and other PRD exclusions remain excluded.
