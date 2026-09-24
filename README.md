# Kanan IELTS Practice Portal

## Overview

A practice and assessment portal for Kanan IELTS General Training and IELTS Academic students, with an Admin portal for managing students, content, access, and reporting.

## Current Development Status

- Product requirements defined.
- UI designs completed externally in Google Stitch.
- Two Stitch source ZIP files awaiting import and audit.
- Application implementation has not started.
- Backend/database implementation has not started.

This repository currently contains planning documentation only. Frontend technology will be confirmed after the Stitch code audit.

## Student Features

- Office-issued Student ID/password login, dashboard, profile, and access status.
- Listening, Reading, Writing, and Speaking practice.
- Assigned-course mock tests with instructions, timed assessment, saving, submission, and appropriate recovery.
- Personal results, detailed results, test history, and module progress.
- Optional course-separated weekly, monthly, and overall leaderboard.
- Locked-course and expired-access states.

Writing and Speaking submissions support future manual/AI evaluation; automated evaluation is not an implemented capability.

## Admin Features

- Admin login and dashboard.
- Student creation, editing, course assignment, access dates, account status, and password resets.
- Question Bank with authoring, preview, duplication, publication, search, and filters.
- Mock Test Builder and independent General/Academic availability controls.
- Student results, reports, and settings.

## Core Business Rules

- Each student belongs to exactly one course: IELTS General or IELTS Academic.
- Practice is available during active portal access without Admin unlocks.
- Each course has 40 mocks. Availability is course-level and independent between courses; individual-student mock permissions must never exist.
- Publication and availability are separate. ON grants access to a published test for all active students in that course.
- Students cannot self-register or change/reset their passwords. Admin controls credentials.
- Expired or disabled accounts cannot use protected functionality. Backend authorization must enforce course, access-period, role, and ownership restrictions.
- Students may access only their own private results; Admin can view authorized reports.
- Production persistence must use real PostgreSQL, with Prisma as the intended ORM. Media belongs in object storage.

## Project Documentation

| File | Purpose |
| --- | --- |
| [PRD.md](PRD.md) | Product scope, user workflows, access rules, acceptance scenarios, and unresolved policies. |
| [AGENTS.md](AGENTS.md) | Concise instructions and safeguards for future Codex sessions. |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | Stitch visual authority, component standards, navigation, responsiveness, and interface states. |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Provisional production layers, domains, authorization, storage, and post-audit decisions. |

## Repository Structure

```text
.
|-- PRD.md
|-- AGENTS.md
|-- DESIGN_SYSTEM.md
|-- ARCHITECTURE.md
`-- README.md
```

No application directories or runtime setup have been created.

## Getting Started

Read the project documentation above. The next planned step, when authorized and the files are supplied, is to audit both Stitch source ZIP files and update the technical documents before implementation.

Technical setup: **To be updated after Stitch code audit.**

## Development

**To be updated after Stitch code audit.**

No framework, package manager, or development commands have been selected. Preserve the supplied Stitch designs, follow AGENTS.md, and document approved decisions before implementing dependent features.

## Environment Variables

**To be updated after Stitch code audit.**

No environment variable names or configuration files are defined yet. Never commit .env files or include secrets in frontend code.

## Testing

**To be updated after Stitch code audit.**

There is no application test suite yet. Future tests must cover course isolation, account access, private results, course-level mock availability, assessment saving/submission, and responsive navigation as described in the project documents.

## Deployment

**To be updated after Stitch code audit.**

Hosting, environments, deployment commands, and operational procedures remain unresolved. Production requires real PostgreSQL and appropriate object storage for assessment media.

## Security Notes

Enforce permissions server-side rather than relying on hidden UI. Securely hash passwords, restrict private results and recordings, protect secrets, and audit sensitive Admin actions. Students obtain credentials and password assistance through the Kanan office. In-memory/mock persistence must never serve as production storage.
