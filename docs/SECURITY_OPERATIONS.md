# Security operations

Updated 28 October 2026. Application controls and automated tests are distinct from verified hosting permissions, production recovery and independent penetration testing. Use this checklist to record evidence; do not treat an automated pass or a numerical rating as security certification.

## Password sign-in

The later 28 October 2026 user decision replaces authenticator-based staff sign-in with email/assigned ID and password for every role. There is no authenticator setup, code, QR, recovery-code or public signup flow. Accounts remain Admin-managed; Students cannot register or reset/change their own passwords.

Assigned IDs match the account ID. Emails match case-insensitively against the account email or a Student's private contact email. An email must identify exactly one account; shared/ambiguous emails fail generically and those users must use their assigned IDs. Contact details remain absent from Trainer responses, reports and exports. Disabled accounts, incorrect roles/passwords, access dates and revoked sessions remain enforced on the server.

Password verification grants a normal hashed-token HttpOnly session directly, including for previously enrolled staff. Canonical-account/source throttles, bounded scrypt work, origin/CSRF checks, database authorization and immutable audits remain active. No environment flag enables an alternate authenticator flow.

Account/access/content operations, evaluation changes, result release and AI retries require recent staff authentication. After five minutes the dialog asks only for the password, then retries the original request once. The server rejects the mutation before changing records while proof is missing. Cancellation retains the unsaved form. Password confirmation is throttled and cannot revive a revoked, disabled or expired session.

## Keys and rollout

- Sign-in and production startup require no authenticator key. No real password, email or account record is changed by this rollout.
- Historical MFA columns/tables and migration `202610280008_staff_mfa` remain for existing database/backup compatibility. They do not validate sessions. Retired authenticator routes and operator reset commands are removed; a stale challenge cookie alone grants no access. Password sign-in clears that obsolete cookie.
- Preserve existing deployment keys and ignored local key files for historical backup/rollback purposes. The Render Blueprint retains the previously generated sign-in key to avoid destroying it, but the application no longer reads or requires it. Do not rotate keys as part of this UI/authentication change.
- `BACKUP_ENCRYPTION_KEY` remains a separate base64 32-byte key for encrypted database archives. Keep it in a protected secret store outside the archive location; losing it makes archives unrecoverable. It is needed for backup commands, not login.
- Local `npm --prefix backend run security:prepare` now prepares only the backup key without printing it. It preserves configured keys and refuses to overwrite an existing key file. Never commit `.env`, local keys or credentials.
- Deploy API and frontend together and refresh older browser tabs. Verify `/api/health` through both Vercel and direct Render access; its revision must match the deployed Git commit. Existing passwords, account access, records and the shared Admin navy palette are preserved.

## Database and object-storage permissions

`DATABASE_URL` is the runtime connection. Set `MIGRATION_DATABASE_URL` separately for schema-owner migrations when using a restricted runtime role. The application needs the required table CRUD and schema usage, not superuser, role/database creation, schema creation or ownership of protected tables. Configure default privileges for future migrations. Do not strip permissions from the only migration/backup connection or rotate credentials without updating the approved secret configuration.

After Admin MFA sign-in, `/api/admin/security` reports common runtime-role elevation flags, staff enrollment and remaining legacy hashes. Its cloud-verification flags deliberately remain false: role flags alone are not a complete grant audit or a production restore certificate. Check table/schema ownership, role memberships/default grants, network rules and owner access in the provider. Trainer/Student requests to this endpoint are forbidden.

The Render database Blueprint blocks public ingress with an empty IP allowlist. Verify the actual resource retains that configuration. Object buckets must be private, use restricted service credentials and permit only required objects/operations. Application entitlement tests do not verify bucket IAM, versioning or retention. Media validation decodes permitted formats and enforces limits; it is not antivirus scanning. Review older uploads separately.

## Encrypted backup and restore verification

Use PostgreSQL 18 client tools (or compatible newer tools) from a trusted operator/backup environment. Configure `PG_DUMP_PATH` / `PG_RESTORE_PATH` when they are not on PATH. Linux CI can explicitly use `PG_CLIENT_DOCKER=true` to run the official `postgres:18` clients on the host network. This Docker mode is intended for the documented Linux test environment, not an assumed Windows Docker networking setup.

Create an encrypted logical database archive with the approved source connection in `BACKUP_DATABASE_URL` (or `DATABASE_URL`) and the separate backup key in the protected environment:

```powershell
npm --prefix backend run backup -- create PATH_TO_NEW_ARCHIVE.enc
```

The command streams a custom-format `pg_dump` through AES-256-GCM, writes with exclusive creation and restrictive file mode where supported, and never writes a plaintext dump. It will not overwrite an existing file. Retain no incomplete archive after a failed run as a usable backup. This logical backup does not include provider configuration, PostgreSQL global roles or object-storage objects; preserve those separately.

Verification requires an **empty local disposable PostgreSQL instance/database**, configured in `RESTORE_DATABASE_URL`, whose database name starts `kanan_restore_`. Never point it at a live instance or a local tunnel to production:

```powershell
npm --prefix backend run backup -- verify PATH_TO_EXISTING_ARCHIVE.enc
```

The entire archive is authenticated before SQL restoration starts, so a wrong key or tampered ciphertext cannot execute a restore. The target must be local and contain no public tables. The command never uses a destructive clean/overwrite option. Restore only archives from trusted sources; SQL backups can contain executable database objects.

After restoration, check actual record counts, attempts/snapshots, score revisions/releases, contact isolation, retained legacy fields and media references. The CI recovery test uses disposable synthetic records and checks legacy-field recovery, audit immutability and refusal to overwrite a populated target. It is not evidence that a current production backup has been restored.

Select an approved off-site destination, schedule, retention, database/media recovery targets and alert owner. Configure managed database recovery/object versioning where supported by the selected plan. Existing free initial-testing infrastructure is not a substitute for that decision. No paid backup service or recurring subscription is created automatically.

## Monitoring and automated checks

Repeated password sign-in failures create coalesced Admin-only security notifications and immutable audit records. Review them in the existing notification/audit screens. A bounded per-process request limiter precedes authentication with a generous 30,000/minute socket-source ceiling so a shared institutional gateway does not consume a low shared login budget. PostgreSQL continues to enforce the stricter canonical-account/password-confirmation/write limits across instances. Configure provider availability, resource, database and failed-job alerts plus log retention separately. Validate trusted client identity at the edge; arbitrary forwarding headers remain untrusted. Cover direct Render ingress as well as Vercel so one path cannot bypass edge limits.

GitHub workflows use pinned action commits and limited permissions. Security checks run on pushes, PRs and a weekly schedule:

- npm advisory checks block high/critical findings.
- Gitleaks scans Git history with comments/artifact summaries disabled. Real credentials stay out of the repository; rotate any genuine exposed key rather than merely deleting it.
- CodeQL uses the extended JavaScript/TypeScript security suite. The SARIF gate blocks high/critical results and fails if analysis output is missing.
- Trivy scans the built image for fixable high/critical OS/library vulnerabilities. Unfixed advisories require review; this gate does not certify their absence.
- Dependabot proposes dependency/action updates for review. Updates are not automatically merged.

The gate resolves CodeQL query-pack extension descriptors and rejects missing/inconsistent metadata. `.github/codeql-reviewed.json` currently contains no exceptions: the earlier random-MFA-cookie trace was removed with the authenticator flow. All high/critical results block unless separately reviewed with exact source/flow/hash evidence and an expiry; the generic gate tests retain those safeguards.

The image scan also covers npm's globally bundled dependencies, which application lockfiles and `npm audit --prefix backend` do not cover. The Dockerfile temporarily replaces vulnerable global npm `undici`/`brace-expansion` packages with verified patch versions from an isolated install; it does not resolve npm's development workspaces or exclude findings. Keep the image gate and runtime startup test enabled when updating/removing that workaround.

Actual workflow conclusions, production edge behavior, infrastructure IAM, real backup restoration, live AI/storage abuse tests and an independent penetration test must be recorded before production security sign-off. Never flood the public testing deployment to simulate denial of service.
