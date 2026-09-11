DROP INDEX `manufacturers_name_key`;--> statement-breakpoint
ALTER TABLE `manufacturers` ADD `user_id` integer REFERENCES users(id);--> statement-breakpoint
CREATE UNIQUE INDEX `manufacturers_global_name_lower_idx` ON `manufacturers` (lower("name")) WHERE "manufacturers"."user_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `manufacturers_user_name_lower_idx` ON `manufacturers` (`user_id`,lower("name")) WHERE "manufacturers"."user_id" IS NOT NULL;