CREATE TABLE "account_invites" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "full_name" SET DATA TYPE varchar(81);--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "first_name" varchar(40) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "last_name" varchar(40) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "account_invites" ADD CONSTRAINT "account_invites_invited_by_accounts_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_invites_token_hash_unique" ON "account_invites" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "account_invites_email_idx" ON "account_invites" USING btree ("email");