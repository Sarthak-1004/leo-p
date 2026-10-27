ALTER TABLE "Attempt" ADD COLUMN "submittedSections" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], ADD COLUMN "reviewedAt" TIMESTAMP(3), ADD COLUMN "reviewerId" TEXT, ADD COLUMN "reviewRemarks" TEXT NOT NULL DEFAULT '';
CREATE INDEX "Attempt_flagged_reviewedAt_idx" ON "Attempt" ("flagged", "reviewedAt");
ALTER TABLE "Result" ADD COLUMN "assignedTrainerId" TEXT;
UPDATE "Result" r SET "assignedTrainerId"=s."trainerId" FROM "Student" s WHERE r."studentId"=s."id";
CREATE INDEX "Result_assignedTrainerId_idx" ON "Result" ("assignedTrainerId");
