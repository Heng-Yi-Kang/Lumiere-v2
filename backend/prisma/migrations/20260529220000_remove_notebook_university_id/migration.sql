-- Drop the old university-scoped notebook index and column.
DROP INDEX IF EXISTS "Notebook_universityId_idx";

ALTER TABLE "Notebook"
DROP COLUMN IF EXISTS "universityId";
