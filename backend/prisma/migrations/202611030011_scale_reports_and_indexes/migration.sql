-- Reports now aggregate stored question-type tallies in SQL. Backfill results scored before
-- the tallies existed, using the same answer normalization as scoring (trim, lower-case, single spaces).
UPDATE "Result" r SET "originalScores" = COALESCE(r."originalScores", '{}'::jsonb) || jsonb_build_object(
  'modules', COALESCE(r."originalScores"->'modules', (SELECT COALESCE(jsonb_agg(DISTINCT q->>'skill'), '[]'::jsonb) FROM jsonb_array_elements(a."snapshot"->'questions') q)),
  'questionTypes', (SELECT COALESCE(jsonb_agg(DISTINCT (q->>'skill') || '/' || (q->>'questionType')), '[]'::jsonb) FROM jsonb_array_elements(a."snapshot"->'questions') q),
  'typeScores', (SELECT COALESCE(jsonb_agg(jsonb_build_object('module', t.skill, 'questionType', t.qt, 'correct', t.correct, 'total', t.total)), '[]'::jsonb) FROM (
    SELECT q->>'skill' AS skill, q->>'questionType' AS qt, count(*)::int AS total,
      (count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(q->'answer') = 'array' THEN q->'answer' ELSE jsonb_build_array(q->'answer') END) k(v)
        WHERE btrim(k.v) <> '' AND lower(regexp_replace(btrim(k.v), '\s+', ' ', 'g')) = lower(regexp_replace(btrim(COALESCE(a."answers"->>((q->>'skill') || ':' || (q->>'id')), '')), '\s+', ' ', 'g')))))::int AS correct
    FROM jsonb_array_elements(a."snapshot"->'questions') q WHERE q->>'skill' IN ('Listening', 'Reading') GROUP BY 1, 2) t))
FROM "Attempt" a WHERE a."id" = r."id" AND NOT (COALESCE(r."originalScores", '{}'::jsonb) ? 'typeScores');
-- Access paths used by dashboards, reports, the leaderboard and notifications at institution scale.
CREATE INDEX "Result_date_idx" ON "Result" ("date");
CREATE INDEX "Result_course_date_idx" ON "Result" ("course", "date");
CREATE INDEX "Result_studentId_course_date_idx" ON "Result" ("studentId", "course", "date");
CREATE INDEX "Result_evaluatedBy_idx" ON "Result" ("evaluatedBy");
CREATE INDEX "ScoreRevision_resultId_idx" ON "ScoreRevision" ("resultId");
CREATE INDEX "Attempt_kind_course_testId_state_idx" ON "Attempt" ("kind", "course", "testId", "state");
CREATE INDEX "Attempt_studentId_course_createdAt_idx" ON "Attempt" ("studentId", "course", "createdAt");
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification" ("userId", "createdAt");
CREATE INDEX "EvaluationJob_createdAt_idx" ON "EvaluationJob" ("createdAt");
