# Private assessment sources

Question packs, answer keys, listening scripts and import CSV files stay local and are ignored by Git. The public repository contains application code and synthetic test fixtures only. No practice pack is automatically installed.

To install an approved private draft pack, place it at `backend/content/original-practice-v1.json` or set `PRIVATE_PRACTICE_PACK_PATH` to an absolute path, then run `npm --prefix backend run content:practice`. Set `CONTENT_ADMIN_ID` if multiple enabled Admin accounts exist. The installer preserves existing questions and creates only unpublished drafts; it never changes tests or attempts.

The optional compiled installer uses `npm --prefix backend run content:practice:production` with a private runtime-mounted pack. Do not publish assessment sources or copy them into frontend assets.
