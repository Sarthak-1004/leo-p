-- Client decision (16 Nov 2026): complete the band tables below the official IELTS rows with the common
-- prep-provider extension. Only tables that still end at the old shipped minimum are extended, so a table an
-- Admin has already customised is left unchanged. Stored results keep the bands they were scored with.
UPDATE "Test" SET "conversions" = jsonb_set("conversions", '{Listening}', ("conversions"->'Listening') || '[[8,3.5],[6,3],[4,2.5],[3,2],[1,1],[0,0]]'::jsonb)
WHERE jsonb_typeof("conversions"->'Listening') = 'array' AND ("conversions"->'Listening'->-1) = '[10,4]'::jsonb;
UPDATE "Test" SET "conversions" = jsonb_set("conversions", '{AcademicReading}', ("conversions"->'AcademicReading') || '[[8,3.5],[6,3],[4,2.5],[3,2],[1,1],[0,0]]'::jsonb)
WHERE jsonb_typeof("conversions"->'AcademicReading') = 'array' AND ("conversions"->'AcademicReading'->-1) = '[10,4]'::jsonb;
UPDATE "Test" SET "conversions" = jsonb_set("conversions", '{GeneralReading}', ("conversions"->'GeneralReading') || '[[6,2.5],[3,2],[1,1],[0,0]]'::jsonb)
WHERE jsonb_typeof("conversions"->'GeneralReading') = 'array' AND ("conversions"->'GeneralReading'->-1) = '[9,3]'::jsonb;
