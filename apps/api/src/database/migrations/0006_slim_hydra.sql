CREATE TABLE "constellation_stars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"couple_id" uuid NOT NULL,
	"constellation_key" varchar(40) NOT NULL,
	"prompt_key" varchar(80),
	"kind" varchar(16) NOT NULL,
	"title" varchar(200) NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"photo_url" varchar(512),
	"pos_x" integer DEFAULT 500 NOT NULL,
	"pos_y" integer DEFAULT 500 NOT NULL,
	"created_by" uuid NOT NULL,
	"lit_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "constellation_stars" ADD CONSTRAINT "constellation_stars_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "constellation_stars" ADD CONSTRAINT "constellation_stars_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;