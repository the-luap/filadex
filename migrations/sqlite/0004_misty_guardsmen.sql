CREATE TABLE `system_settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`registration_enabled` integer DEFAULT true,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer))
);
--> statement-breakpoint
INSERT INTO `system_settings` (`id`, `registration_enabled`) VALUES (1, 1) ON CONFLICT (`id`) DO NOTHING;
