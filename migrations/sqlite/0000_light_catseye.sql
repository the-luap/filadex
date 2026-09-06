CREATE TABLE `api_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`label` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
	`last_used_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_tokens_token_hash_key` ON `api_tokens` (`token_hash`);--> statement-breakpoint
CREATE TABLE `backup_settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`enabled` integer DEFAULT false,
	`schedule` text DEFAULT 'off' NOT NULL,
	`time` text DEFAULT '02:00' NOT NULL,
	`day_of_week` integer DEFAULT 1,
	`retention_count` integer DEFAULT 7 NOT NULL,
	`last_backup_at` integer,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer))
);
--> statement-breakpoint
CREATE TABLE `catalog_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`entity_type` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`review_note` text,
	`reviewed_by` integer,
	`reviewed_at` integer,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `colors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `community_filament_cache` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`manufacturer` text NOT NULL,
	`material` text NOT NULL,
	`name` text NOT NULL,
	`color_name` text NOT NULL,
	`color_code` text,
	`density` text,
	`diameter` text,
	`extruder_temp` integer,
	`bed_temp` integer,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer))
);
--> statement-breakpoint
CREATE INDEX `community_filament_cache_search_idx` ON `community_filament_cache` (`manufacturer`,`name`,`color_name`);--> statement-breakpoint
CREATE TABLE `custom_field_definitions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`entity_type` text DEFAULT 'filament' NOT NULL,
	`name` text NOT NULL,
	`field_type` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `diameters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`value` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `diameters_value_key` ON `diameters` (`value`);--> statement-breakpoint
CREATE TABLE `email_settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`enabled` integer DEFAULT false,
	`smtp_host` text,
	`smtp_port` integer,
	`smtp_user` text,
	`smtp_password` text,
	`smtp_secure` integer DEFAULT true,
	`from_email` text,
	`from_name` text,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer))
);
--> statement-breakpoint
CREATE TABLE `filament_types` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`manufacturer` text,
	`material` text NOT NULL,
	`color_name` text NOT NULL,
	`color_code` text,
	`diameter` text,
	`print_temp` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `filament_usage_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`filament_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`delta_weight` text NOT NULL,
	`remaining_percentage_after` text NOT NULL,
	`note` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
	FOREIGN KEY (`filament_id`) REFERENCES `filaments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `filament_usage_log_filament_id_idx` ON `filament_usage_log` (`filament_id`);--> statement-breakpoint
CREATE TABLE `filaments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`filament_type_id` integer NOT NULL,
	`name` text NOT NULL,
	`total_weight` text NOT NULL,
	`remaining_percentage` text NOT NULL,
	`purchase_date` text,
	`purchase_price` text,
	`status` text,
	`spool_type` text,
	`dryer_count` integer DEFAULT 0 NOT NULL,
	`last_drying_date` text,
	`storage_location` text,
	`low_stock_notified_at` integer,
	`drying_reminder_notified_at` integer,
	`custom_field_values` text DEFAULT '{}',
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`filament_type_id`) REFERENCES `filament_types`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `manufacturers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 999,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `manufacturers_name_key` ON `manufacturers` (`name`);--> statement-breakpoint
CREATE TABLE `materials` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`user_id` integer,
	`sort_order` integer DEFAULT 999,
	`density` text,
	`is_hygroscopic` integer DEFAULT false,
	`attention_dismissed` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `materials_global_name_lower_idx` ON `materials` (lower("name")) WHERE "materials"."user_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `materials_user_name_lower_idx` ON `materials` (`user_id`,lower("name")) WHERE "materials"."user_id" IS NOT NULL;--> statement-breakpoint
CREATE TABLE `storage_locations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 999,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `storage_locations_name_key` ON `storage_locations` (`name`);--> statement-breakpoint
CREATE TABLE `user_sharing` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`material_id` integer,
	`is_public` integer DEFAULT false,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`password` text NOT NULL,
	`is_admin` integer DEFAULT false,
	`role` text DEFAULT 'user' NOT NULL,
	`email` text,
	`email_verified` integer DEFAULT false,
	`email_verification_token` text,
	`email_verification_expires` integer,
	`password_reset_token` text,
	`password_reset_expires` integer,
	`force_change_password` integer DEFAULT true,
	`language` text DEFAULT 'en',
	`currency` text DEFAULT 'EUR',
	`temperature_unit` text DEFAULT 'C',
	`last_login` integer,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`low_stock_threshold_percent` integer DEFAULT 15,
	`notify_low_stock` integer DEFAULT true,
	`notify_drying_reminder` integer DEFAULT true,
	`drying_reminder_days` integer DEFAULT 30,
	`theme_variant` text DEFAULT 'professional',
	`theme_primary` text DEFAULT '#EA580C',
	`theme_appearance` text DEFAULT 'dark',
	`theme_radius` text DEFAULT '0.8',
	`username_folded` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_key` ON `users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_key` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_folded_idx` ON `users` (`username_folded`);