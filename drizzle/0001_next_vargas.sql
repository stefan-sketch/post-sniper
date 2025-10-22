CREATE TABLE "managed_pages" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"userId" varchar(64) NOT NULL,
	"profileId" varchar(128) NOT NULL,
	"profileName" varchar(255) NOT NULL,
	"profilePicture" text,
	"borderColor" varchar(7) NOT NULL,
	"network" varchar(32) DEFAULT 'facebook' NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "twitter_posts" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"text" text,
	"image" text,
	"authorName" varchar(255) NOT NULL,
	"authorUsername" varchar(255) NOT NULL,
	"authorAvatar" text,
	"likes" integer DEFAULT 0,
	"retweets" integer DEFAULT 0,
	"replies" integer DEFAULT 0,
	"views" integer DEFAULT 0,
	"url" text,
	"createdAt" timestamp NOT NULL,
	"fetchedAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "cached_posts" ADD COLUMN "previousReactions" integer DEFAULT 0;--> statement-breakpoint
CREATE INDEX "idx_twitter_posts_created_at" ON "twitter_posts" USING btree ("createdAt" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_alerts_user_id" ON "alerts" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_alerts_triggered_at" ON "alerts" USING btree ("triggeredAt" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_cached_posts_post_date" ON "cached_posts" USING btree ("postDate" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_cached_posts_page_id" ON "cached_posts" USING btree ("pageId");--> statement-breakpoint
CREATE INDEX "idx_cached_posts_reactions" ON "cached_posts" USING btree ("reactions" DESC NULLS LAST);