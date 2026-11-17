-- Client decision (17 Nov 2026): Listening audio in Practice Mocks and FLTs plays once with no pause or rewind.
-- The attempt keeps the furthest audio position so a reload continues instead of restarting.
ALTER TABLE "Attempt" ADD COLUMN "audioPart" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Attempt" ADD COLUMN "audioMs" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Attempt" ADD CONSTRAINT "attempt_audio_position" CHECK ("audioPart" >= 0 AND "audioMs" >= 0);
