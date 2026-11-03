-- Hidden-tab time is still connected exam time; record it separately for review.
ALTER TABLE "Attempt" ADD COLUMN "hiddenMs" INTEGER NOT NULL DEFAULT 0;
-- Whether the latest acknowledged signal came from a hidden tab: a gap after it is flagged for review.
ALTER TABLE "Attempt" ADD COLUMN "lastHidden" BOOLEAN NOT NULL DEFAULT false;
-- Browsers that previously signed in successfully keep their own sign-in failure budget,
-- so a stranger's wrong guesses cannot lock a student out of their usual device.
CREATE TABLE "TrustedDevice" (
  "tokenHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TrustedDevice_pkey" PRIMARY KEY ("tokenHash")
);
CREATE INDEX "TrustedDevice_userId_idx" ON "TrustedDevice"("userId");
ALTER TABLE "TrustedDevice" ADD CONSTRAINT "TrustedDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
