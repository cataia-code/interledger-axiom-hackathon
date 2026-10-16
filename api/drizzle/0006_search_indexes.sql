CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX "item_public_price_idx" ON "item" USING btree ("price_amount","id") WHERE "item"."status" = 'active' and "item"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "item_name_trgm_idx" ON "item" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "item_description_trgm_idx" ON "item" USING gin ("description" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "item_store_idx" ON "item" USING btree ("store_id","id");