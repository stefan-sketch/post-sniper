CREATE TABLE `posts` (
	`id` varchar(255) NOT NULL,
	`pageId` varchar(64) NOT NULL,
	`pageName` text NOT NULL,
	`network` varchar(32) DEFAULT 'facebook',
	`message` text,
	`image` text,
	`link` text,
	`postDate` timestamp NOT NULL,
	`reactions` int DEFAULT 0,
	`comments` int DEFAULT 0,
	`shares` int DEFAULT 0,
	`rawData` text,
	`lastUpdated` timestamp DEFAULT (now()),
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `posts_id` PRIMARY KEY(`id`)
);
