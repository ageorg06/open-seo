/**
 * Site-level AI-search readiness checks: which AI crawlers robots.txt keeps
 * off the homepage, and whether /llms.txt exists. Both are reported against
 * the homepage URL with no page row (like crawl-rate-limited).
 */
import robotsParser from "robots-parser";
import type { DetectedIssue } from "@/server/lib/audit/issues/page-reporters";

// Fetch pages live to answer a question: blocking them removes the site from
// AI answers.
const LIVE_ANSWER_CRAWLERS = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
  "Perplexity-User",
  "Claude-SearchBot",
  "Claude-User",
];

// Only feed model training: blocking them doesn't affect live answers.
const TRAINING_CRAWLERS = [
  "GPTBot",
  "Google-Extended",
  "ClaudeBot",
  "CCBot",
  "Applebot-Extended",
];

export function findAiSearchReadinessIssues(input: {
  origin: string;
  /** null = robots.txt missing/unreachable, so nothing is blocked. */
  robotsText: string | null;
  /** null = unknown. Optional: older workflow checkpoints don't have it. */
  hasLlmsTxt?: boolean | null;
}): DetectedIssue[] {
  const homepage = `${input.origin}/`;
  const issues: DetectedIssue[] = [];
  const report = (
    issueType: DetectedIssue["issueType"],
    details?: Record<string, unknown>,
  ) => issues.push({ issueType, pageId: null, pageUrl: homepage, details });

  if (input.robotsText !== null) {
    const robots = robotsParser(`${input.origin}/robots.txt`, input.robotsText);
    // robots-parser picks the agent's own group, else `*`.
    const blocked = (agents: string[]) =>
      agents.filter((agent) => robots.isAllowed(homepage, agent) === false);
    const liveBlocked = blocked(LIVE_ANSWER_CRAWLERS);
    const trainingBlocked = blocked(TRAINING_CRAWLERS);
    // A string, not an array: the issue view renders arrays as redirect chains.
    if (liveBlocked.length > 0) {
      report("ai-search-crawlers-blocked", {
        crawlers: liveBlocked.join(", "),
      });
    }
    if (trainingBlocked.length > 0) {
      report("ai-training-crawlers-blocked", {
        crawlers: trainingBlocked.join(", "),
      });
    }
  }

  if (input.hasLlmsTxt === false) report("missing-llms-txt");

  return issues;
}
