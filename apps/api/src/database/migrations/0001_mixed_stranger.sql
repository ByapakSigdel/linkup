CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"couple_id" uuid NOT NULL,
	"uploader_id" uuid NOT NULL,
	"type" varchar(20) NOT NULL,
	"filename" varchar(500) NOT NULL,
	"original_filename" varchar(500) NOT NULL,
	"storage_key" varchar(1000) NOT NULL,
	"storage_bucket" varchar(100) DEFAULT 'local',
	"cdn_url" text,
	"mime_type" varchar(100) NOT NULL,
	"file_size" bigint NOT NULL,
	"duration" integer,
	"width" integer,
	"height" integer,
	"processing_status" varchar(20) DEFAULT 'completed',
	"thumbnails" jsonb,
	"variants" jsonb,
	"metadata" jsonb,
	"album_id" uuid,
	"tags" json DEFAULT '[]'::json,
	"caption" varchar(2000),
	"is_streak_photo" boolean DEFAULT false,
	"streak_date" date,
	"is_favorite" boolean DEFAULT false,
	"is_archived" boolean DEFAULT false,
	"is_deleted" boolean DEFAULT false,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "media_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "media_albums" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"couple_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" varchar(1000),
	"cover_media_id" uuid,
	"is_shared" boolean DEFAULT true,
	"is_auto" boolean DEFAULT false,
	"media_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_uploader_id_users_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_album_id_media_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."media_albums"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_albums" ADD CONSTRAINT "media_albums_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_albums" ADD CONSTRAINT "media_albums_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;