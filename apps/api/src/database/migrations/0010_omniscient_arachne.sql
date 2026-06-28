ALTER TABLE "couples" ALTER COLUMN "survivor_decision" DROP DEFAULT;--> statement-breakpoint
-- Migration 0009 planted DEFAULT 'pending' on survivor_decision for every couple,
-- including live, never-ended ones. survivor_decision is only meaningful once a
-- couple has ended; clear the misleading value from any couple that has NOT ended
-- so the column reads NULL until the deletion transaction sets it explicitly.
UPDATE "couples" SET "survivor_decision" = NULL WHERE "relationship_status" IS DISTINCT FROM 'ended' AND "survivor_decision" = 'pending';
