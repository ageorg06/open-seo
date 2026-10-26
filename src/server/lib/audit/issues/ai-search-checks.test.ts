import { describe, expect, it } from "vitest";
import { findAiSearchReadinessIssues } from "@/server/lib/audit/issues/ai-search-checks";

const origin = "https://example.com";

function run(robotsText: string | null, hasLlmsTxt: boolean | null = true) {
  return findAiSearchReadinessIssues({ origin, robotsText, hasLlmsTxt });
}

describe("findAiSearchReadinessIssues", () => {
  it("flags a blocked live-answer crawler, not the training crawlers", () => {
    const issues = run("User-agent: OAI-SearchBot\nDisallow: /");

    expect(issues).toEqual([
      {
        issueType: "ai-search-crawlers-blocked",
        pageId: null,
        pageUrl: "https://example.com/",
        details: { crawlers: "OAI-SearchBot" },
      },
    ]);
  });

  it("reports a training-only block as a notice only", () => {
    const issues = run("User-agent: GPTBot\nDisallow: /");

    expect(issues.map((issue) => issue.issueType)).toEqual([
      "ai-training-crawlers-blocked",
    ]);
    expect(issues[0].details).toEqual({ crawlers: "GPTBot" });
  });

  it("applies the wildcard group, but a specific group overrides it", () => {
    const issues = run(
      "User-agent: *\nDisallow: /\n\nUser-agent: OAI-SearchBot\nAllow: /",
    );

    const live = issues.find(
      (issue) => issue.issueType === "ai-search-crawlers-blocked",
    );
    expect(live?.details?.crawlers).not.toContain("OAI-SearchBot");
    expect(live?.details?.crawlers).toContain("PerplexityBot");
    expect(
      issues.find((issue) => issue.issueType === "ai-training-crawlers-blocked")
        ?.details?.crawlers,
    ).toContain("GPTBot");
  });

  it("reports nothing when robots.txt allows everything or is missing", () => {
    expect(run("User-agent: *\nAllow: /")).toEqual([]);
    expect(run(null)).toEqual([]);
  });

  it("reports a missing llms.txt only when it is definitely missing", () => {
    expect(run(null, false).map((issue) => issue.issueType)).toEqual([
      "missing-llms-txt",
    ]);
    expect(run(null, null)).toEqual([]);
  });
});
