import { beforeEach, describe, expect, it, vi } from "vitest";
import { aiAssistantForSource } from "@/shared/ga4";
import type { Ga4RunReportRequest } from "@/server/lib/ga4Client";
import { makeGa4Connection } from "./ga4-test-fixtures";
import { Ga4AiTrafficService } from "./Ga4AiTrafficService";

const mocks = vi.hoisted(() => ({
  getByProjectId: vi.fn(),
  runReport: vi.fn<(request: Ga4RunReportRequest) => unknown>(),
}));

vi.mock("@/server/features/ga4/repositories/Ga4ConnectionRepository", () => ({
  Ga4ConnectionRepository: { getByProjectId: mocks.getByProjectId },
}));

vi.mock("@/server/lib/ga4Client", () => ({
  createGa4DataClient: () => ({ runReport: mocks.runReport }),
}));

// Metrics in AI_TRAFFIC_METRICS order: sessions, engagedSessions, rate, keyEvents.
function report(
  request: Ga4RunReportRequest,
  rows: Array<[string[], string[]]>,
) {
  return {
    dimensionHeaders: request.dimensions,
    metricHeaders: request.metrics,
    rows: rows.map(([dimensions, metrics]) => ({
      dimensionValues: dimensions.map((value) => ({ value })),
      metricValues: metrics.map((value) => ({ value })),
    })),
    rowCount: rows.length,
  };
}

describe("aiAssistantForSource", () => {
  it("names AI assistant sources and ignores everything else", () => {
    expect(aiAssistantForSource("chatgpt.com")).toBe("ChatGPT");
    expect(aiAssistantForSource("perplexity")).toBe("Perplexity");
    expect(aiAssistantForSource("gemini.google.com")).toBe("Gemini");
    expect(aiAssistantForSource("claude.ai")).toBe("Claude");
    expect(aiAssistantForSource("google")).toBeNull();
    expect(aiAssistantForSource("youtube.com")).toBeNull();
  });
});

describe("Ga4AiTrafficService", () => {
  beforeEach(() => {
    mocks.getByProjectId.mockResolvedValue(makeGa4Connection());
  });

  it("rolls sources up by assistant, with share and comparison", async () => {
    mocks.runReport.mockImplementation((request: Ga4RunReportRequest) => {
      const dimension = request.dimensions[0]?.name;
      if (request.dimensionFilter === undefined) {
        return report(request, [[[], ["1000"]]]);
      }
      if (dimension === "sessionSource") {
        return report(request, [
          [["chatgpt.com"], ["60", "45", "0.75", "3"]],
          [["perplexity"], ["20", "10", "0.5", "1"]],
          [["openai"], ["10", "5", "0.5", "0"]],
          [["(direct)"], ["10", "10", "1", "0"]],
        ]);
      }
      if (dimension === "landingPage" || dimension === "hostName") {
        return report(request, [
          [
            ["example.com", "/pricing"],
            ["50", "40", "0.8", "4"],
          ],
        ]);
      }
      if (dimension === "date") {
        return report(request, [[["20260805"], ["12", "9", "0.75", "1"]]]);
      }
      const isPrevious = request.dateRanges[0]?.endDate < "2026-07-09";
      return report(request, [
        [[], isPrevious ? ["50", "30", "0.6", "2"] : ["100", "70", "0.7", "4"]],
      ]);
    });

    const result = await Ga4AiTrafficService.getAiTraffic(
      {
        projectId: "project_1",
        startDate: "2026-07-09",
        endDate: "2026-08-05",
      },
      { now: new Date("2026-08-06T15:00:00Z") },
    );

    // chatgpt.com and openai are one assistant; the channel-group-only
    // "(direct)" row has no known name.
    expect(result.assistants.map((a) => [a.assistant, a.sessions])).toEqual([
      ["ChatGPT", 70],
      ["Perplexity", 20],
      ["Other AI assistant", 10],
    ]);
    expect(result.totals).toMatchObject({
      sessions: 100,
      allSessions: 1000,
      shareOfSessions: 0.1,
    });
    expect(result.comparison.sessions).toMatchObject({
      previous: 50,
      percentChange: 1,
    });
    expect(result.landingPages[0]).toMatchObject({
      landingPage: "/pricing",
      sessions: 50,
    });
    const requests = mocks.runReport.mock.calls.map(([request]) => request);
    const filtered = requests.filter(
      (request) => request.dimensionFilter !== undefined,
    );
    expect(JSON.stringify(filtered[0]?.dimensionFilter)).toContain(
      "PARTIAL_REGEXP",
    );
  });
});
