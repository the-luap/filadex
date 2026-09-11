CREATE TABLE "generic_terms" (
	"id" serial PRIMARY KEY NOT NULL,
	"word" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "generic_terms_word_key" UNIQUE("word")
);
