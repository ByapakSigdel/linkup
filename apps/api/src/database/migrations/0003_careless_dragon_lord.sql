CREATE TABLE "call_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"couple_id" uuid NOT NULL,
	"caller_id" uuid NOT NULL,
	"callee_id" uuid NOT NULL,
	"type" varchar(20) DEFAULT 'voice',
	"status" varchar(20) DEFAULT 'ringing',
	"started_at" timestamp,
	"ended_at" timestamp,
	"duration_sec" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "circle_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"circle_id" uuid NOT NULL,
	"couple_id" uuid NOT NULL,
	"role" varchar(20) DEFAULT 'member',
	"joined_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "circle_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"circle_id" uuid NOT NULL,
	"couple_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"content" text NOT NULL,
	"type" varchar(20) DEFAULT 'post',
	"media_urls" json DEFAULT '[]'::json,
	"metadata" jsonb,
	"like_count" integer DEFAULT 0,
	"comment_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "circles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" varchar(1000),
	"cover_image_url" text,
	"created_by_couple_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"is_private" boolean DEFAULT true,
	"max_members" integer DEFAULT 10,
	"invite_code" varchar(30),
	"member_count" integer DEFAULT 1,
	"post_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "circles_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "custom_emojis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"couple_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"name" varchar(50) NOT NULL,
	"image_url" text NOT NULL,
	"category" varchar(30) DEFAULT 'custom',
	"is_animated" boolean DEFAULT false,
	"use_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"device_type" varchar(20) NOT NULL,
	"device_token" varchar(500) NOT NULL,
	"device_name" varchar(100),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "friend_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_couple_id" uuid NOT NULL,
	"from_user_id" uuid NOT NULL,
	"to_user_id" uuid,
	"to_email" varchar(255),
	"invite_code" varchar(30) NOT NULL,
	"permissions" jsonb,
	"status" varchar(20) DEFAULT 'pending',
	"expires_at" timestamp NOT NULL,
	"accepted_by" uuid,
	"accepted_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "friend_invitations_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "friendships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"couple_id" uuid NOT NULL,
	"friend_user_id" uuid,
	"friend_couple_id" uuid,
	"initiated_by" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'active',
	"permissions" jsonb DEFAULT '{"viewPhotos":true,"viewVideos":false,"viewMessages":false,"viewAchievements":true,"commentOnPosts":true}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "paintings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"couple_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"title" varchar(100),
	"width" integer DEFAULT 1024,
	"height" integer DEFAULT 768,
	"background_color" varchar(20) DEFAULT '#ffffff',
	"thumbnail_url" text,
	"image_url" text,
	"strokes" jsonb DEFAULT '[]'::jsonb,
	"status" varchar(20) DEFAULT 'active',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "playlist_tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"playlist_id" uuid NOT NULL,
	"added_by" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"artist" varchar(200),
	"album" varchar(200),
	"cover_url" text,
	"source" varchar(20) DEFAULT 'youtube',
	"source_id" varchar(200),
	"url" text,
	"duration" integer,
	"position" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "playlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"couple_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" varchar(500),
	"cover_url" text,
	"track_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "post_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "post_likes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "scribbles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"couple_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"image_url" text NOT NULL,
	"strokes" jsonb DEFAULT '[]'::jsonb,
	"background_color" varchar(20) DEFAULT '#ffffff',
	"message_id" uuid,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "soundboard_sounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"couple_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"name" varchar(50) NOT NULL,
	"audio_url" text NOT NULL,
	"emoji" varchar(20),
	"category" varchar(30) DEFAULT 'custom',
	"duration" integer,
	"color" varchar(20),
	"use_count" integer DEFAULT 0,
	"is_built_in" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "verification_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code" varchar(10) NOT NULL,
	"purpose" varchar(30) DEFAULT 'email_verification',
	"expires_at" timestamp NOT NULL,
	"consumed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "watch_parties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"couple_id" uuid NOT NULL,
	"host_id" uuid NOT NULL,
	"source" varchar(20) DEFAULT 'youtube',
	"video_id" varchar(200),
	"video_url" text,
	"title" varchar(300),
	"status" varchar(20) DEFAULT 'active',
	"created_at" timestamp DEFAULT now(),
	"ended_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "email_notifications" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "reaction_notifications" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "achievement_notifications" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "circle_notifications" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "quiet_hours_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "quiet_hours_start" varchar(5) DEFAULT '22:00';--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "quiet_hours_end" varchar(5) DEFAULT '08:00';--> statement-breakpoint
ALTER TABLE "call_sessions" ADD CONSTRAINT "call_sessions_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_sessions" ADD CONSTRAINT "call_sessions_caller_id_users_id_fk" FOREIGN KEY ("caller_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_sessions" ADD CONSTRAINT "call_sessions_callee_id_users_id_fk" FOREIGN KEY ("callee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_members" ADD CONSTRAINT "circle_members_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_members" ADD CONSTRAINT "circle_members_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_posts" ADD CONSTRAINT "circle_posts_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_posts" ADD CONSTRAINT "circle_posts_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_posts" ADD CONSTRAINT "circle_posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circles" ADD CONSTRAINT "circles_created_by_couple_id_couples_id_fk" FOREIGN KEY ("created_by_couple_id") REFERENCES "public"."couples"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circles" ADD CONSTRAINT "circles_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_emojis" ADD CONSTRAINT "custom_emojis_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_emojis" ADD CONSTRAINT "custom_emojis_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_invitations" ADD CONSTRAINT "friend_invitations_from_couple_id_couples_id_fk" FOREIGN KEY ("from_couple_id") REFERENCES "public"."couples"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_invitations" ADD CONSTRAINT "friend_invitations_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_invitations" ADD CONSTRAINT "friend_invitations_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_invitations" ADD CONSTRAINT "friend_invitations_accepted_by_users_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_friend_user_id_users_id_fk" FOREIGN KEY ("friend_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_friend_couple_id_couples_id_fk" FOREIGN KEY ("friend_couple_id") REFERENCES "public"."couples"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_initiated_by_users_id_fk" FOREIGN KEY ("initiated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paintings" ADD CONSTRAINT "paintings_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paintings" ADD CONSTRAINT "paintings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_tracks" ADD CONSTRAINT "playlist_tracks_playlist_id_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_tracks" ADD CONSTRAINT "playlist_tracks_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_post_id_circle_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."circle_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_post_id_circle_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."circle_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scribbles" ADD CONSTRAINT "scribbles_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scribbles" ADD CONSTRAINT "scribbles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soundboard_sounds" ADD CONSTRAINT "soundboard_sounds_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soundboard_sounds" ADD CONSTRAINT "soundboard_sounds_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_codes" ADD CONSTRAINT "verification_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_parties" ADD CONSTRAINT "watch_parties_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_parties" ADD CONSTRAINT "watch_parties_host_id_users_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;