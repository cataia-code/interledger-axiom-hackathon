ALTER TABLE "user_wallet" DROP CONSTRAINT "user_wallet_user_id_unique";--> statement-breakpoint
ALTER TABLE "user_wallet" ADD COLUMN "is_primary" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "user_wallet" SET "is_primary" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "user_wallet_one_primary" ON "user_wallet" USING btree ("user_id") WHERE "user_wallet"."is_primary";--> statement-breakpoint
CREATE INDEX "user_wallet_user_idx" ON "user_wallet" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "user_wallet" ADD CONSTRAINT "user_wallet_user_address_unique" UNIQUE("user_id","address");