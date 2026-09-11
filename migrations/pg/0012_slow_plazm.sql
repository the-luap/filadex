DO $$
DECLARE conflict text;
BEGIN
  SELECT string_agg(duplicate, ', ') INTO conflict
    FROM (SELECT lower(name) AS duplicate FROM manufacturers
          GROUP BY lower(name) HAVING count(*) > 1) duplicates;
  IF conflict IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot add case-insensitive manufacturer uniqueness: duplicate names exist (%). Merge or rename them, then re-run.', conflict;
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "manufacturers" DROP CONSTRAINT "manufacturers_name_key";--> statement-breakpoint
ALTER TABLE "manufacturers" ADD COLUMN "user_id" integer;--> statement-breakpoint
ALTER TABLE "manufacturers" ADD CONSTRAINT "manufacturers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "manufacturers_global_name_lower_idx" ON "manufacturers" USING btree (lower("name")) WHERE "manufacturers"."user_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "manufacturers_user_name_lower_idx" ON "manufacturers" USING btree (coalesce("user_id", 0),lower("name")) WHERE "manufacturers"."user_id" IS NOT NULL;