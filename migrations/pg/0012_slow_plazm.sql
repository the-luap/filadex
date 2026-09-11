ALTER TABLE "manufacturers" DROP CONSTRAINT "manufacturers_name_key";--> statement-breakpoint
ALTER TABLE "manufacturers" ADD COLUMN "user_id" integer;--> statement-breakpoint
ALTER TABLE "manufacturers" ADD CONSTRAINT "manufacturers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
DELETE FROM "manufacturers"
WHERE "id" NOT IN (
  SELECT min("id")
  FROM "manufacturers"
  GROUP BY coalesce("user_id", -1), lower("name")
);--> statement-breakpoint
CREATE UNIQUE INDEX "manufacturers_global_name_lower_idx" ON "manufacturers" USING btree (lower("name")) WHERE "manufacturers"."user_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "manufacturers_user_name_lower_idx" ON "manufacturers" USING btree (coalesce("user_id", 0),lower("name")) WHERE "manufacturers"."user_id" IS NOT NULL;