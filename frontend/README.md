# Kanan IELTS frontend

React/TypeScript/Vite frontend. The default mode uses the authenticated PostgreSQL API. Read the root README, PRD, architecture and design system before changes.

From this directory use `npm ci`, `npm run dev`, `npm run typecheck`, `npm run lint` and `npm run build`. Vite proxies /api to http://127.0.0.1:3001 unless API_PROXY_TARGET is set.

The optional fixture review requires VITE_DEMO_MODE=true. It resets on reload and must not replace live storage. `npm run test:e2e` runs the explicit demo suite; `npm run test:live` tests the connected API with an isolated real PostgreSQL database.
