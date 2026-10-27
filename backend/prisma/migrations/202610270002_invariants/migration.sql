ALTER TABLE "Student" ADD CONSTRAINT "student_one_course" CHECK ("course" IN ('GENERAL','ACADEMIC'));
ALTER TABLE "Student" ADD CONSTRAINT "student_valid_dates" CHECK ("startDate" <= "expiryDate");
ALTER TABLE "Test" ADD CONSTRAINT "test_catalog_scope" CHECK ("course" IN ('GENERAL','ACADEMIC') AND "kind" IN ('FLT','PRACTICE_MOCK') AND "number">0 AND ("kind"!='FLT' OR "number"<=40));
ALTER TABLE "Test" ADD CONSTRAINT "practice_without_unlock" CHECK ("kind"!='PRACTICE_MOCK' OR NOT "available");
ALTER TABLE "Attempt" ADD CONSTRAINT "attempt_limits" CHECK ("number">0 AND ("kind"!='FLT' OR "number"<=1) AND ("kind"!='PRACTICE_MOCK' OR "number"<=2));
ALTER TABLE "Attempt" ADD CONSTRAINT "attempt_time_nonnegative" CHECK ("remainingMs">=0 AND "interruptions">=0 AND "sequence">=0);
CREATE UNIQUE INDEX "one_in_progress_attempt" ON "Attempt" ("studentId","course","testId") WHERE "state"='IN_PROGRESS';
ALTER TABLE "Result" ADD CONSTRAINT "release_requires_scores" CHECK (NOT "released" OR "kind"!='FLT' OR ("listening" IS NOT NULL AND "reading" IS NOT NULL AND "writing" IS NOT NULL));
CREATE FUNCTION deny_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Historical audit records are append-only'; END; $$;
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION deny_history_mutation();
CREATE TRIGGER scores_append_only BEFORE UPDATE OR DELETE ON "ScoreRevision" FOR EACH ROW EXECUTE FUNCTION deny_history_mutation();
CREATE FUNCTION preserve_attempt_context() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF NEW."snapshot" IS DISTINCT FROM OLD."snapshot" OR NEW."studentId"!=OLD."studentId" OR NEW."course"!=OLD."course" OR NEW."testId"!=OLD."testId" OR NEW."kind"!=OLD."kind" OR NEW."number"!=OLD."number" THEN RAISE EXCEPTION 'Attempt context is immutable'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER immutable_attempt_context BEFORE UPDATE ON "Attempt" FOR EACH ROW EXECUTE FUNCTION preserve_attempt_context();
