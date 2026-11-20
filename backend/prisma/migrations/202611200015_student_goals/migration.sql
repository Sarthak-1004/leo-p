-- Student-set exam date and target band for the dashboard (study goals only).
ALTER TABLE "Student" ADD COLUMN "examDate" TEXT;
ALTER TABLE "Student" ADD COLUMN "targetBand" DOUBLE PRECISION;
ALTER TABLE "Student" ADD CONSTRAINT "student_target_band" CHECK ("targetBand" IS NULL OR ("targetBand" >= 4 AND "targetBand" <= 9 AND ("targetBand" * 2) = floor("targetBand" * 2)));
