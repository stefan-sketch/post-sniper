ALTER TABLE `user_settings` MODIFY COLUMN `useMockData` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `fanpageKarmaToken` text;