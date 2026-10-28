ALTER TABLE "User" ADD COLUMN "mfaSecret" TEXT,
  ADD COLUMN "mfaVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "mfaLastCounter" INTEGER NOT NULL DEFAULT -1;
ALTER TABLE "Session" ADD COLUMN "mfaVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "mfaVerifiedAt" TIMESTAMP(3), ADD COLUMN "reauthUntil" TIMESTAMP(3);
CREATE TABLE "AuthChallenge" (
  "tokenHash" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "authVersion" INTEGER NOT NULL, "mfaVersion" INTEGER NOT NULL,
  "csrfToken" TEXT NOT NULL, "secretCipher" TEXT, "verifiedAt" TIMESTAMP(3), "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "AuthChallenge_expiresAt_idx" ON "AuthChallenge"("expiresAt");
CREATE TABLE "RecoveryCode" (
  "hash" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE, "usedAt" TIMESTAMP(3)
);
CREATE INDEX "RecoveryCode_userId_idx" ON "RecoveryCode"("userId");
