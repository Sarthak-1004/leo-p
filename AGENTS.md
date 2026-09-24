# Instructions for future Codex sessions

## Read first

- Read PRD.md before changing product functionality.
- Read DESIGN_SYSTEM.md before modifying UI.
- Read ARCHITECTURE.md before major technical or infrastructure changes.
- Keep these documents consistent when an approved decision changes.

## Current stage

- This repository is documentation-only; application and backend implementation have not started.
- For the initial documentation task, create/update only PRD.md, AGENTS.md, DESIGN_SYSTEM.md, ARCHITECTURE.md, and README.md, then stop.
- Until a subsequent task authorizes implementation/import, do not create application code or frontend/backend folders, install dependencies, initialize Prisma/database schemas, or extract Stitch ZIP files.
- Frontend technology is to be confirmed after Stitch code audit. Do not assume a framework or invent setup commands.

## Product and security

- Each student belongs to exactly one IELTS course: General or Academic.
- Practice needs no Admin unlock during active access.
- Mock availability is course-level; General and Academic settings are independent. Never add individual-student mock permissions.
- Keep mock publication separate from availability.
- Students cannot self-register or reset/change their own passwords; Admin controls student credentials.
- Enforce roles, course access, account status, access dates, and private-resource ownership server-side. Frontend hiding is insufficient.
- Hash passwords securely. Never commit .env files or expose secrets in frontend code or logs.
- Production persistence must use real PostgreSQL. In-memory/mock persistence must never become production persistence.

## UI and implementation

- Supplied Google Stitch designs are the primary visual source of truth. Do not redesign Stitch pages unless explicitly instructed.
- Keep interface text minimal and preserve intentional responsive behavior.
- Preserve the collapsible desktop sidebar: icons remain visible when labels disappear, with accessible labels/tooltips and an identifiable active page.
- On mobile, use hamburger navigation and a drawer; do not reserve permanent desktop sidebar space.
- Prefer reusable components, follow existing conventions once Stitch code is imported, and avoid unnecessary architecture complexity.
- Do not modify unrelated working code unnecessarily.
- After implementing features, run relevant tests and report results and any verification limitations.
