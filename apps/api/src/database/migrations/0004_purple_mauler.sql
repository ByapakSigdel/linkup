-- Circles rebuild (Instagram-for-couples): couple profiles + one-way follows + stories.
-- HAND-EDITED from drizzle-kit output into the data-safe order from the design spec
-- migrationPlan: backup -> clean reset -> alter circles -> alter circle_posts ->
-- post_likes/post_comments -> create circle_follows -> create stories -> drop legacy.
-- All data steps run BEFORE destructive drops so fresh and existing DBs converge;
-- on an empty DB every data step is a harmless no-op.

-- ─── STEP 1: BACKUP old group/friends data to *_legacy tables (nothing irrecoverable) ───
CREATE TABLE "circle_members_legacy" AS SELECT * FROM "circle_members";--> statement-breakpoint
CREATE TABLE "circles_legacy" AS SELECT * FROM "circles";--> statement-breakpoint
CREATE TABLE "circle_posts_legacy" AS SELECT * FROM "circle_posts";--> statement-breakpoint
CREATE TABLE "friendships_legacy" AS SELECT * FROM "friendships";--> statement-breakpoint
CREATE TABLE "friend_invitations_legacy" AS SELECT * FROM "friend_invitations";--> statement-breakpoint

-- ─── STEP 2: CLEAN RESET of incompatible group-circle data (backed up above) ───
DELETE FROM "post_likes";--> statement-breakpoint
DELETE FROM "post_comments";--> statement-breakpoint
DELETE FROM "circle_posts";--> statement-breakpoint
DELETE FROM "circle_members";--> statement-breakpoint
DELETE FROM "circles";--> statement-breakpoint

-- ─── STEP 3: ALTER circles -> couple profile shape + unique constraints ───
ALTER TABLE "circles" ADD COLUMN "handle" varchar(30);--> statement-breakpoint
ALTER TABLE "circles" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "circles" ADD COLUMN "follower_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "circles" ADD COLUMN "following_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "circles" ALTER COLUMN "is_private" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "circles" DROP CONSTRAINT "circles_invite_code_unique";--> statement-breakpoint
ALTER TABLE "circles" DROP COLUMN "max_members";--> statement-breakpoint
ALTER TABLE "circles" DROP COLUMN "invite_code";--> statement-breakpoint
ALTER TABLE "circles" DROP COLUMN "member_count";--> statement-breakpoint
-- (Backfill of handle/avatar is a no-op since circles is now empty. On a non-truncate path,
--  backfill handle = lower(regexp_replace(couple_name,'[^a-z0-9]','-','gi'))||'-'||left(id::text,6)
--  and avatar from couples BEFORE adding the UNIQUE constraints below.)
ALTER TABLE "circles" ADD CONSTRAINT "circles_handle_unique" UNIQUE("handle");--> statement-breakpoint
CREATE UNIQUE INDEX "circles_owner_unique" ON "circles" USING btree ("created_by_couple_id");--> statement-breakpoint

-- ─── STEP 4: ALTER circle_posts -> photo-first; add profile-grid/feed index ───
ALTER TABLE "circle_posts" ALTER COLUMN "content" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "circle_posts" ALTER COLUMN "type" SET DEFAULT 'photo';--> statement-breakpoint
CREATE INDEX "circle_posts_circle_created_idx" ON "circle_posts" USING btree ("circle_id","created_at");--> statement-breakpoint

-- ─── STEP 5: post_likes unique (dedupe first for non-truncate path) + post_comments index ───
DELETE FROM "post_likes" a USING "post_likes" b WHERE a."id" > b."id" AND a."post_id" = b."post_id" AND a."user_id" = b."user_id";--> statement-breakpoint
CREATE UNIQUE INDEX "post_likes_post_user_unique" ON "post_likes" USING btree ("post_id","user_id");--> statement-breakpoint
CREATE INDEX "post_comments_post_created_idx" ON "post_comments" USING btree ("post_id","created_at");--> statement-breakpoint

-- ─── STEP 6: CREATE circle_follows (one-way circle->circle follow edge) ───
CREATE TABLE "circle_follows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"follower_circle_id" uuid NOT NULL,
	"following_circle_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'accepted' NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"accepted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "circle_follows" ADD CONSTRAINT "circle_follows_follower_circle_id_circles_id_fk" FOREIGN KEY ("follower_circle_id") REFERENCES "public"."circles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_follows" ADD CONSTRAINT "circle_follows_following_circle_id_circles_id_fk" FOREIGN KEY ("following_circle_id") REFERENCES "public"."circles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_follows" ADD CONSTRAINT "circle_follows_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "circle_follows_pair_unique" ON "circle_follows" USING btree ("follower_circle_id","following_circle_id");--> statement-breakpoint
CREATE INDEX "circle_follows_following_status_idx" ON "circle_follows" USING btree ("following_circle_id","status");--> statement-breakpoint
CREATE INDEX "circle_follows_follower_status_idx" ON "circle_follows" USING btree ("follower_circle_id","status");--> statement-breakpoint

-- ─── STEP 7: CREATE circle_stories + circle_story_views (ephemeral 24h stories) ───
CREATE TABLE "circle_stories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"circle_id" uuid NOT NULL,
	"couple_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"media_url" text NOT NULL,
	"media_type" varchar(20) DEFAULT 'image' NOT NULL,
	"duration_ms" integer DEFAULT 5000,
	"caption" varchar(500),
	"view_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "circle_story_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"viewer_user_id" uuid NOT NULL,
	"viewer_circle_id" uuid,
	"viewed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "circle_stories" ADD CONSTRAINT "circle_stories_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_stories" ADD CONSTRAINT "circle_stories_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_stories" ADD CONSTRAINT "circle_stories_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_story_views" ADD CONSTRAINT "circle_story_views_story_id_circle_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."circle_stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_story_views" ADD CONSTRAINT "circle_story_views_viewer_user_id_users_id_fk" FOREIGN KEY ("viewer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_story_views" ADD CONSTRAINT "circle_story_views_viewer_circle_id_circles_id_fk" FOREIGN KEY ("viewer_circle_id") REFERENCES "public"."circles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "circle_stories_circle_expires_idx" ON "circle_stories" USING btree ("circle_id","expires_at");--> statement-breakpoint
CREATE INDEX "circle_stories_expires_idx" ON "circle_stories" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "circle_story_views_story_viewer_unique" ON "circle_story_views" USING btree ("story_id","viewer_user_id");--> statement-breakpoint

-- ─── STEP 8: DROP retired tables (data preserved in *_legacy backups above) ───
DROP TABLE "circle_members" CASCADE;--> statement-breakpoint
DROP TABLE "friend_invitations" CASCADE;--> statement-breakpoint
DROP TABLE "friendships" CASCADE;
