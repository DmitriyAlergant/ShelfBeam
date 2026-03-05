ALTER TABLE "reader_profile" ADD COLUMN "age" smallint;--> statement-breakpoint
ALTER TABLE "reader_profile" ADD COLUMN "grade" smallint;--> statement-breakpoint
UPDATE "reader_profile" SET "age" = 2026 - "birth_year", "grade" = GREATEST(0, LEAST(12, 2026 - "birth_year" - 5)) WHERE "birth_year" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "reader_profile" DROP COLUMN IF EXISTS "birth_year";
