ALTER TABLE "couples" ADD COLUMN "ended_at" timestamp;--> statement-breakpoint
ALTER TABLE "couples" ADD COLUMN "ended_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "couples" ADD COLUMN "survivor_decision" varchar(20) DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "couples" ADD COLUMN "survivor_decided_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "archived_couple_id" uuid;--> statement-breakpoint
ALTER TABLE "couples" ADD CONSTRAINT "couples_ended_by_user_id_users_id_fk" FOREIGN KEY ("ended_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_archived_couple_id_couples_id_fk" FOREIGN KEY ("archived_couple_id") REFERENCES "public"."couples"("id") ON DELETE no action ON UPDATE no action;