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


## GitHub, Vercel and Railway testing deployment

Repository: https://github.com/Sarthak-1004/leo-p. Use branch `main`. Keep the project root at the repository root for both providers. The public repository excludes local credentials/databases, private question packs/answer keys and original Stitch archives. Local content is not copied to the hosted database.

1. Import this repository into a Vercel project. Keep framework preset **Other**, Node **24.x**, root **./**, install `npm ci --prefix frontend` and build `npm run build:vercel` from vercel.json. Do not override the output directory: the build emits `.vercel/output` using the Build Output API. Reserve/observe the actual stable project domain. Initial builds intentionally fail until BACKEND_ORIGIN is configured.
2. Create a Railway testing project with PostgreSQL and a service connected to the same repository. Use the root Dockerfile/railway.json. Set DATABASE_URL using the PostgreSQL service reference, NODE_ENV=production, APP_ORIGIN to the exact stable Vercel HTTPS origin (no trailing slash), and ACCESS_TIMEZONE=Asia/Kolkata. Railway supplies PORT. The pre-deploy command applies the versioned migrations; health checks require a database connection. Keep the API service running so background jobs can execute.
3. Generate the API service's Railway HTTPS domain. Set Vercel BACKEND_ORIGIN to that exact origin (no `/api` suffix) for the testing deployment's environment. Do not enable VITE_DEMO_MODE. Redeploy Vercel. Browser API requests remain on the Vercel origin; the build-generated proxy forwards to Railway. The SPA fallback excludes API paths so API failures cannot become successful HTML responses.
4. In a protected Railway shell/environment, supply fresh BOOTSTRAP_ADMIN_ID, BOOTSTRAP_ADMIN_NAME and BOOTSTRAP_ADMIN_PASSWORD (12-128 characters). Run `npm run db:seed:production` from `/app/backend` once. Remove BOOTSTRAP_ADMIN_PASSWORD afterward. This creates only an initial Admin, settings and 40 empty unpublished FLT slots per course. Never reuse the local review password or upload backend/.env. Share testing credentials through your team's private channel.
5. Check the frontend login routes and direct-page refresh, `/api/health`, anonymous `/api/bootstrap` rejection, successful cookie/CSRF login, account creation and persistence after redeploy. Verify private API responses use Cache-Control: no-store, unreleased FLT results stay hidden, and media authorization/range requests work when storage is configured. Run the browser acceptance workflows against the hosted origin before inviting testers.

Manual Writing evaluation and empty catalogs work without AI or storage keys. Media uploads/playback require a configured private S3 bucket; paid AI requests require approved provider credentials and limits. Keep both unconfigured until supplied. Hosting connections and any paid plan selection must be completed in the owner's accounts. No provider subscription or live resource is created just by committing these files.

The routing configuration is covered by `npm run test:deployment`. A local packaging check may set BACKEND_ORIGIN to `https://api.example.test` and run `npm run build:vercel`; that is a synthetic build check, not a usable hosted API or deployment.

Reference: [Vercel Build Output API](https://vercel.com/docs/build-output-api) and [Railway configuration reference](https://docs.railway.com/config-as-code/reference).
