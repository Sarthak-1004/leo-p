-- Client decision (16 Nov 2026): 52 Full Length Tests per course. New slots 41-52 are created by the idempotent seed.
ALTER TABLE "Test" DROP CONSTRAINT "test_catalog_scope";
ALTER TABLE "Test" ADD CONSTRAINT "test_catalog_scope" CHECK ("course" IN ('GENERAL','ACADEMIC') AND "kind" IN ('FLT','PRACTICE_MOCK') AND "number">0 AND ("kind"!='FLT' OR "number"<=52));
