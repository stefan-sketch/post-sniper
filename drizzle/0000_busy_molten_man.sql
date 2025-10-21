CREATE TYPE "public"."role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"userId" varchar(64) NOT NULL,
	"pageId" varchar(64) NOT NULL,
	"postId" varchar(255) NOT NULL,
	"postLink" text,
	"postMessage" text,
	"postImage" text,
	"reactionCount" integer NOT NULL,
	"threshold" integer NOT NULL,
	"postDate" timestamp,
	"triggeredAt" timestamp DEFAULT now(),
	"isRead" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "cached_posts" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"pageId" varchar(64) NOT NULL,
	"pageName" varchar(255) NOT NULL,
	"borderColor" varchar(7) NOT NULL,
	"profilePicture" text,
	"message" text,
	"image" text,
	"link" text,
	"postDate" timestamp NOT NULL,
	"reactions" integer DEFAULT 0,
	"comments" integer DEFAULT 0,
	"shares" integer DEFAULT 0,
	"alertThreshold" integer,
	"alertEnabled" boolean,
	"fetchedAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "monitored_pages" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"userId" varchar(64) NOT NULL,
	"profileId" varchar(128) NOT NULL,
	"profileName" varchar(255) NOT NULL,
	"profilePicture" text,
	"borderColor" varchar(7) NOT NULL,
	"network" varchar(32) DEFAULT 'facebook' NOT NULL,
	"alertThreshold" integer DEFAULT 100,
	"alertEnabled" boolean DEFAULT true,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"userId" varchar(64) PRIMARY KEY NOT NULL,
	"fanpageKarmaToken" text,
	"autoRefreshEnabled" boolean DEFAULT true,
	"refreshInterval" integer DEFAULT 600,
	"useMockData" boolean DEFAULT false,
	"isPlaying" boolean DEFAULT false,
	"lastFetchedAt" timestamp,
	"lastAPIStatus" text DEFAULT 'success',
	"lastDataHash" text,
	"apiSyncOffset" integer DEFAULT 0,
	"dismissedPosts" text,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"lastSignedIn" timestamp DEFAULT now()
);
