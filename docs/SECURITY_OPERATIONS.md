# Security operations

Updated 28 October 2026. Application controls and automated tests are distinct from verified hosting permissions, production recovery and independent penetration testing. Use this checklist to record evidence; do not treat an automated pass or a numerical rating as security certification.

## Staff authentication

Admin and Trainer accounts always require MFA. No environment flag bypasses it. Student accounts retain office-issued password sign-in and cannot register or reset/change their own passwords.

On first staff sign-in, the correct password creates a five-minute restricted challenge in a separate HttpOnly cookie. Scan the locally generated QR code with a compatible authenticator app or enter the setup key. A valid six-digit code enables the factor. Save the ten one-use recovery codes separately from the password and acknowledge them before the portal opens. The setup secret/codes are never sent to a third-party QR service or stored in browser storage.

Later sign-ins accept a fresh authenticator code or an unused recovery code. The server rejects reused TOTP counters and atomically consumes recovery codes. Repeated failures are throttled across challenges; successful verification resets the consecutive-attempt budget. Password resets/account changes invalidate pending challenges. Existing staff sessions without MFA proof cannot access protected APIs after rollout.

Account/access/content operations, evaluation changes, result release and AI retries require recent staff authentication. After five minutes the client asks for the password and another MFA/recovery code, then retries the original request once. The server rejects the mutation before it changes records while proof is missing. Cancellation preserves the unsaved form and reports that nothing was saved.

TOTP is not phishing-resistant. Staff must protect their devices/passwords and recovery codes; higher-assurance passkey enrollment and an independent review remain possible later work.

## Keys and rollout

- `MFA_ENCRYPTION_KEY`: base64 encoding of 32 cryptographically random bytes. TOTP secrets use AES-256-GCM with per-record random IVs and account-bound authenticated data. Production refuses to start without this key.
- `BACKUP_ENCRYPTION_KEY`: a separate base64 32-byte key for encrypted database archives. Keep both keys in a protected secret store outside the archive location, with documented owner access and recovery. Losing the MFA key requires recovery/re-enrollment; losing a backup key makes its archive unrecoverable.
- Local `npm --prefix backend run security:prepare` generates missing keys into ignored files/environment configuration without printing them. It preserves configured keys and refuses to overwrite an existing key file. Do not commit these files.
- The existing Render Blueprint adds both values using `generateValue: true`. Render documents this as a random base64 256-bit value, preserved when already present. Confirm the Blueprint sync and environment before rollout; never paste real keys into GitHub, chat or frontend variables.
- Apply migration `202610280008_staff_mfa` and deploy API/UI together. The Render startup script applies additive migrations before starting the service. Refresh old browser tabs to use acknowledged section transitions and the MFA client flow.
- Verify `/api/health` through both Vercel and direct Render access. On Render, its `revision` must match the deployed Git commit. A Vercel preview origin is not automatically permitted by the stable API's exact `APP_ORIGIN` policy.
- Each staff member completes enrollment on their own device. Do not share an Admin login/authenticator among developers. No real staff credential or factor is enrolled by the automated tests.

## Lost authenticator recovery

Try an unused recovery code first. If none remains, an authorized deployment operator verifies the staff member's identity outside this portal and runs the existing recovery command in the trusted backend environment:

```powershell
npm --prefix backend run security:reset-mfa -- --user STAFF_ID --remarks "Verified staff identity and recovery request" --confirm-reenrollment
```

The compiled deployment equivalent is `security:reset-mfa:production`. This operation clears the factor, revokes all affected sessions/challenges/recovery codes, advances authorization versions and records the operator/reason. It grants no portal session: the staff member must sign in and enroll again. It cannot reset Student credentials. Treat database/deployment access as privileged; an account without operator access cannot use this CLI.

The free hosting plan may not provide an interactive shell. Confirm a trusted operator execution/recovery path and keep unused recovery codes before relying on it for production. Do not open the database to all public IPs to work around that limitation.

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

After restoration, check actual record counts, attempts/snapshots, score revisions/releases, contact isolation, encrypted MFA records and media references. The CI recovery test uses disposable synthetic records and checks ciphertext recovery, audit immutability and refusal to overwrite a populated target. It is not evidence that a current production backup has been restored.

Select an approved off-site destination, schedule, retention, database/media recovery targets and alert owner. Configure managed database recovery/object versioning where supported by the selected plan. Existing free initial-testing infrastructure is not a substitute for that decision. No paid backup service or recurring subscription is created automatically.

## Monitoring and automated checks

Repeated login/MFA failures, staff recovery-code use and operator factor reset create coalesced Admin-only security notifications and immutable audit records. Review them in the existing notification/audit screens. Configure provider availability, resource, database and failed-job alerts plus log retention separately. Validate trusted client identity at the edge; arbitrary forwarding headers remain untrusted. Cover direct Render ingress as well as Vercel so one path cannot bypass edge limits.

GitHub workflows use pinned action commits and limited permissions. Security checks run on pushes, PRs and a weekly schedule:

- npm advisory checks block high/critical findings.
- Gitleaks scans Git history with comments/artifact summaries disabled. Real credentials stay out of the repository; rotate any genuine exposed key rather than merely deleting it.
- CodeQL uses the extended JavaScript/TypeScript security suite. The SARIF gate blocks high/critical results and fails if analysis output is missing.
- Trivy scans the built image for fixable high/critical OS/library vulnerabilities. Unfixed advisories require review; this gate does not certify their absence.
- Dependabot proposes dependency/action updates for review. Updates are not automatically merged.

Actual workflow conclusions, production edge behavior, infrastructure IAM, real backup restoration, live AI/storage abuse tests and an independent penetration test must be recorded before production security sign-off. Never flood the public testing deployment to simulate denial of service.
