CREATE TABLE "backup_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"enabled" boolean DEFAULT false,
	"schedule" text DEFAULT 'off' NOT NULL,
	"time" text DEFAULT '02:00' NOT NULL,
	"day_of_week" integer DEFAULT 1,
	"retention_count" integer DEFAULT 7 NOT NULL,
	"last_backup_at" timestamp,
	"updated_at" timestamp DEFAULT now()
);
