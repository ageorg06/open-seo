CREATE TABLE `project_brand_aliases` (
	`project_id` text NOT NULL,
	`domain` text NOT NULL,
	`alias` text NOT NULL,
	PRIMARY KEY(`project_id`, `domain`, `alias`),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
