CREATE TABLE "circle_conversation_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_user_id" uuid NOT NULL,
	"sender_circle_id" uuid NOT NULL,
	"content" text,
	"media_urls" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "circle_conversation_reads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"circle_id" uuid NOT NULL,
	"last_read_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "circle_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"circle_lo_id" uuid NOT NULL,
	"circle_hi_id" uuid NOT NULL,
	"last_message_at" timestamp,
	"last_message_preview" varchar(280),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "circle_conversation_messages" ADD CONSTRAINT "circle_conversation_messages_conversation_id_circle_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."circle_conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_conversation_messages" ADD CONSTRAINT "circle_conversation_messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_conversation_messages" ADD CONSTRAINT "circle_conversation_messages_sender_circle_id_circles_id_fk" FOREIGN KEY ("sender_circle_id") REFERENCES "public"."circles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_conversation_reads" ADD CONSTRAINT "circle_conversation_reads_conversation_id_circle_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."circle_conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_conversation_reads" ADD CONSTRAINT "circle_conversation_reads_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_conversations" ADD CONSTRAINT "circle_conversations_circle_lo_id_circles_id_fk" FOREIGN KEY ("circle_lo_id") REFERENCES "public"."circles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_conversations" ADD CONSTRAINT "circle_conversations_circle_hi_id_circles_id_fk" FOREIGN KEY ("circle_hi_id") REFERENCES "public"."circles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "circle_conv_messages_conv_created_idx" ON "circle_conversation_messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "circle_conversation_reads_conv_circle_unique" ON "circle_conversation_reads" USING btree ("conversation_id","circle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "circle_conversations_pair_unique" ON "circle_conversations" USING btree ("circle_lo_id","circle_hi_id");