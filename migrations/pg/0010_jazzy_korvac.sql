CREATE TABLE "system_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"registration_enabled" boolean DEFAULT true,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
INSERT INTO "system_settings" ("id", "registration_enabled") VALUES (1, true) ON CONFLICT ("id") DO NOTHING;
