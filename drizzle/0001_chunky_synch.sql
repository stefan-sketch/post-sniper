CREATE TABLE `alerts` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`pageId` varchar(64) NOT NULL,
	`postId` varchar(255) NOT NULL,
	`postLink` text,
	`postMessage` text,
	`postImage` text,
	`reactionCount` int NOT NULL,
	`threshold` int NOT NULL,
	`postDate` timestamp,
	`triggeredAt` timestamp DEFAULT (now()),
	`isRead` boolean DEFAULT false,
	CONSTRAINT `alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `monitored_pages` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`profileId` varchar(128) NOT NULL,
	`profileName` varchar(255) NOT NULL,
	`profilePicture` text,
	`borderColor` varchar(7) NOT NULL,
	`network` varchar(32) NOT NULL DEFAULT 'facebook',
	`alertThreshold` int DEFAULT 100,
	`alertEnabled` boolean DEFAULT true,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()),
	CONSTRAINT `monitored_pages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_settings` (
	`userId` varchar(64) NOT NULL,
	`fanpageKarmaToken` text,
	`autoRefreshEnabled` boolean DEFAULT true,
	`refreshInterval` int DEFAULT 600,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()),
	CONSTRAINT `user_settings_userId` PRIMARY KEY(`userId`)
);
