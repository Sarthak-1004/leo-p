# Deployment and operations

## Configuration

Node 24 is required. Production uses a real PostgreSQL service and a private S3-compatible bucket. The local PostgreSQL runner is a development/test convenience, not a managed production service.

Set server environment variables from `backend/.env.example`. Use a secret manager or protected environment, never frontend variables. Required runtime settings are DATABASE_URL and APP_ORIGIN; NODE_ENV=production requires an HTTPS APP_ORIGIN. The browser and `/api` must share an origin. Do not enable VITE_DEMO_MODE for a production build.

S3_BUCKET, S3_REGION and the provider credentials/endpoint enable media uploads. An AWS IAM role may supply credentials instead of static keys. Keep bucket contents private. Grant the application only needed object read/write permissions for its bucket. Student downloads go through an authenticated entitlement check; Speaking recordings are excluded.

OPENAI_API_KEY and OPENAI_MODEL enable Writing evaluation. The example model is configurable, and OPENAI_BASE_URL supports an approved replacement endpoint. Configure project spending limits and verify rubric/output quality with client-approved essays before enabling production evaluation. Missing configuration gives an explicit failed/manual-review state; it does not fabricate scores. Automated tests exercise a deterministic provider contract, not paid live AI calls.

## Build and migrate

```powershell
npm ci --prefix backend
npm ci --prefix frontend
npm --prefix backend run db:generate
npm run build
```

Apply migrations with the production DATABASE_URL before starting a release:

```powershell
npm --prefix backend run db:migrate
```

For the first Admin and the 80 empty FLT slots, run `npm --prefix backend run setup` interactively, or supply BOOTSTRAP_ADMIN_ID/NAME/PASSWORD to the seed command through a protected environment. After compilation, `npm --prefix backend run db:seed:production` uses the compiled seed. Passwords are hashed, never printed, and there are no default production student/trainer accounts.

The Dockerfile builds the UI/API and runs as an unprivileged user. Pass DATABASE_URL, APP_ORIGIN and provider configuration at runtime. Port 3001 serves the frontend and API. Terminate TLS at your approved proxy; the application does not accept arbitrary forwarded identity headers. The Docker definition and GitHub workflow are prepared but were not executed locally because Docker is unavailable on this machine.

## Process and jobs

Start the compiled backend with `npm --prefix backend start`. It fails if PostgreSQL is unavailable. `/api/health` checks the database. The Writing job worker runs with the API process, claims PostgreSQL leases and preserves outputs/retries. Multiple workers use SKIP LOCKED; a stale lease is recoverable.

Configure process restarts, memory/CPU limits, request/body timeouts and logging retention. Logs redact cookies/authorization and do not include passwords, essay bodies or service keys. Inspect failed evaluation jobs, import errors and interruption flags through operational workflows. Alerts and infrastructure-level dashboards require the selected host's configuration.

## Backups and recovery

Schedule encrypted PostgreSQL backups and object-storage versioning/backup according to the institution's retention policy. Use an operational account separate from application access. Test restoration into an isolated database and verify counts, attempts, snapshots, score revisions, releases and media references. Never test restoration by overwriting the live database.

Keep migrations and a tested rollback/recovery plan with every release. Append-only audit/score triggers intentionally reject modification; do not disable them to perform routine application actions. Session/throttle/import records require an approved retention/cleanup schedule before go-live.

## Launch gates

- Supply licensed complete content/audio/images and confirm Practice Mock counts per course.
- Configure complete raw-score conversion tables, including the lower rows omitted by the SOW.
- Validate actual S3 uploads/range playback and real Writing AI output, retry behavior and cost.
- Test target browser/device audio behavior, disconnects, server restart/outage, concurrent tabs, expired/reassigned accounts and timed section transitions.
- Run production load/concurrency, security, backup/restore and accessibility checks against the chosen host.
- Confirm leaderboard/progress policies, retention and support contacts; complete client UAT and staff training.

These gates are not certified by passing local tests. No production site or external account was created or deployed during this implementation.

## Content-deferred operation

The user deferred real papers/audio/images. Empty catalogs and draft FLTs are valid while the office prepares content. Application acceptance can use isolated fixtures; do not import those fixtures into the real catalog. Enter full conversion rows and licensed content before publication. Media Library and CSV/XLSX imports are available after storage configuration.

The Admin Operations screen reports configuration presence and queued/failed evaluation counts without exposing keys. Configured is not a live-provider health certification. Automatic Writing evaluation can be disabled in Settings; manual review remains available. Required result/revision/assignment notifications remain enabled. Support details are public institution fields; student contacts remain private.

Academic task figures are read from private storage by the Writing worker and supplied as image inputs with the prompt/essay. Images are bounded to ten unique files and 20 MB total per evaluation; model/base URL must support image inputs. This path follows the [official OpenAI image-input format](https://developers.openai.com/api/docs/guides/images-vision?api-mode=responses) and is verified against local deterministic contracts, not an external paid call. Imported/stored figures remain protected at student media endpoints.

Local compiled-production smoke verification checks database health, SPA fallback, built JavaScript delivery, anonymous API rejection and CSP. It does not substitute for deploying the Docker image or validating the selected proxy, production database, provider accounts and backup restoration.


## GitHub, Vercel and Render testing deployment

Repository: https://github.com/Sarthak-1004/leo-p, branch `main`. Render replaces Railway for this deployment because the owner cannot currently sign up for Railway. The owner selected free hosting for initial testing. Keep the project root at the repository root for both providers. The public repository excludes local credentials/databases, private question packs/answer keys and original Stitch archives. Local content is not copied to the hosted database.

1. Import this repository into a Vercel project. Keep framework preset **Other**, Node **24.x**, root **./**, install `npm ci --prefix frontend` and build `npm run build:vercel` from vercel.json. Do not override the output directory: the build emits `.vercel/output` using the Build Output API. Observe the actual stable project domain. Initial builds intentionally fail until BACKEND_ORIGIN is configured.
2. In Render choose **New > Blueprint**, connect this repository and use root `render.yaml`. Review that both resources use the **Free** plan and Singapore region. Set APP_ORIGIN to the exact stable Vercel HTTPS origin (no trailing slash). Render creates the web service and PostgreSQL 18 database, injects the private connection string, blocks external database access and generates a fresh bootstrap Admin password. The API listens on Render's PORT and health checks use `/api/health`.
3. Free services have neither pre-deploy commands nor shell access. The Blueprint's Docker command runs `npm run db:migrate`, then `npm run db:seed:production`, then starts the API with `exec node dist/src/server.js`. Startup fails if initialization fails. These scripts run on subsequent cold starts/redeploys too: they preserve existing Admin credentials/settings/tests and insert only missing empty draft FLT slots. No demo users, questions or assessment content are installed. Keep one API instance for this testing setup.
4. Once the API is healthy, copy its actual Render HTTPS origin into Vercel BACKEND_ORIGIN (no `/api` suffix) and redeploy Vercel. Do not enable VITE_DEMO_MODE. Browser API requests remain on the Vercel origin; the generated proxy forwards them to Render before SPA fallback. Cookies remain same-origin and mutations require the exact APP_ORIGIN and session CSRF token. Preview URLs are not automatically authorized.
5. Sign in at the Vercel Admin login using ID `admin` and the generated BOOTSTRAP_ADMIN_PASSWORD from the Render service's protected Environment settings. Keep the password private and never reuse the local review password. The seed never resets an existing account on restart. The generated environment value can remain protected for repeat startup; if you remove it after initialization, also remove its generateValue entry from the Blueprint to prevent regeneration on sync. Without that value, subsequent seeds still succeed as long as an Admin exists.
6. Check direct-page refresh, `/api/health`, anonymous `/api/bootstrap` rejection, cookie/CSRF login, account creation and persistence after redeploy. Verify private API responses use Cache-Control: no-store and unreleased FLT scores remain hidden. Validate authorized media/range requests when storage is configured. Check GitHub Actions before inviting testers; render.yaml deploys automatically after CI checks pass.

### Free-plan limits and test data

Render's [free-plan limits](https://render.com/docs/free) include idle suspension after 15 minutes and roughly one minute to wake on the next request. During suspension the API worker cannot process Writing jobs or reminders. Cold starts can exceed the frontend's request timeout: wait until the API's `/api/health` returns status ok, then reload/sign in again. Do not claim continuous worker testing on this plan or bypass suspension with artificial keep-alive traffic.

The free PostgreSQL database expires after 30 days. Plan a backup/migration or approved upgrade before the expiry shown in the Render dashboard; never rely on this tier for permanent student records. Free API filesystems are ephemeral, so PostgreSQL remains the only application database and private S3 storage is required for media. Free-tier usage limits and provider eligibility also apply. No paid resources or subscriptions are authorized by this free configuration.

Manual Writing evaluation and empty catalogs work without AI or storage keys. Media uploads/playback require a configured private S3 bucket; paid AI requests require approved credentials and limits. Both remain unconfigured until supplied. Hosting accounts/connections, provisioning and hosted smoke checks are still required before a usable testing URL exists.

The routing configuration is covered by `npm run test:deployment`. A local packaging check can set BACKEND_ORIGIN to `https://api.example.test` and run `npm run build:vercel`; this synthetic check is not a hosted deployment. GitHub's container job also exercises the migration/bootstrap/start sequence used by the free Render service.

Reference: [Vercel Build Output API](https://vercel.com/docs/build-output-api), [Render Blueprint specification](https://render.com/docs/blueprint-spec) and [Render deployment commands](https://render.com/docs/deploys).
