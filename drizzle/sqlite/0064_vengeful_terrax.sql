DROP INDEX `ai_observations_run_prompt_engine_idx`;--> statement-breakpoint
ALTER TABLE `ai_observations` ADD `sample` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `ai_observations_run_prompt_engine_idx` ON `ai_observations` (`run_id`,`prompt_id`,`engine`,`sample`);--> statement-breakpoint
ALTER TABLE `ai_trackers` ADD `answers_per_prompt` integer DEFAULT 1 NOT NULL;