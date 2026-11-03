-- Module practice reveals answer keys; remove every test question from the practice pool.
UPDATE "Question" q SET "practiceEligible"=false, "version"=q."version"+1
WHERE q."practiceEligible" AND EXISTS (
  SELECT 1 FROM "Test" t
  CROSS JOIN LATERAL jsonb_each(CASE WHEN jsonb_typeof(t."builder"->'questionIds')='object' THEN t."builder"->'questionIds' ELSE '{}'::jsonb END) s
  CROSS JOIN LATERAL jsonb_array_elements_text(CASE WHEN jsonb_typeof(s.value)='array' THEN s.value ELSE '[]'::jsonb END) e(id)
  WHERE e.id=q."id"
);
ALTER TABLE "Question" ALTER COLUMN "practiceEligible" SET DEFAULT false;
