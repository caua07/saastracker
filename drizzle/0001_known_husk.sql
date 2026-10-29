CREATE TABLE "bank_syncs" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"item_id" text NOT NULL,
	"status" text NOT NULL,
	"state" jsonb,
	"lock_token" text,
	"locked_until" timestamp with time zone,
	"last_success_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "bank_syncs" ADD CONSTRAINT "bank_syncs_owner_id_app_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bank_sync_owner_idx" ON "bank_syncs" USING btree ("owner_id");