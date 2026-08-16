-- Migration: Add candidate_email column to cases table
-- This column was added to the Drizzle schema but was missing from the initial migration.

ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS candidate_email VARCHAR(255) NOT NULL DEFAULT '';

-- Remove the DEFAULT constraint now that the column exists.
-- Existing rows will have an empty string; new rows must provide a value.
ALTER TABLE cases
  ALTER COLUMN candidate_email DROP DEFAULT;
