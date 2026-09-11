DROP INDEX `manufacturers_name_key`;--> statement-breakpoint
ALTER TABLE `manufacturers` ADD `user_id` integer REFERENCES users(id);--> statement-breakpoint
DELETE FROM `manufacturers` WHERE `id` NOT IN (SELECT min(`id`) FROM `manufacturers` GROUP BY coalesce(`user_id`, -1), lower(`name`));--> statement-breakpoint
CREATE UNIQUE INDEX `manufacturers_global_name_lower_idx` ON `manufacturers` (lower("name")) WHERE "manufacturers"."user_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `manufacturers_user_name_lower_idx` ON `manufacturers` (`user_id`,lower("name")) WHERE "manufacturers"."user_id" IS NOT NULL;