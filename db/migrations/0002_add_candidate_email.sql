-- Migration: Add candidate_email column to cases table
-- This column was added to the Drizzle schema but was missing from the initial migration.
--
-- The column is NOT NULL in the final state. Legacy rows that predate the column
-- (draft/awaiting_documents cases) are backfilled with a valid placeholder so the
-- value always satisfies the .email() contract; new rows must provide a real value.

ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS candidate_email VARCHAR(255);

-- Backfill any legacy rows so every case has a valid email.
UPDATE cases
  SET candidate_email = 'candidate@tieout.local'
  WHERE candidate_email IS NULL OR candidate_email = '';

ALTER TABLE cases
  ALTER COLUMN candidate_email SET NOT NULL;

-- Remove the default so new inserts must provide a value explicitly.
ALTER TABLE cases
  ALTER COLUMN candidate_email DROP DEFAULT;
