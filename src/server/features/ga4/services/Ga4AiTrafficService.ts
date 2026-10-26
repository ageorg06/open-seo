import { Ga4ConnectionRepository } from "@/server/features/ga4/repositories/Ga4ConnectionRepository";
import { createGa4DataClient } from "@/server/lib/ga4Client";
import { Ga4ReportError } from "@/server/lib/ga4Errors";
import { aiAssistantForSource } from "@/shared/ga4";
import {
  buildGa4AiTrafficRequest,
  type Ga4AiTrafficSlice,
} from "./Ga4ReportDefinitions";
import { comparisonValue, previousPeriod } from "./Ga4ReportEnhancements";
import { normalizeGa4Response } from "./Ga4ReportNormalization";
import { mapGa4ReportError, resolveGa4DateRange } from "./Ga4ReportingService";

type Ga4AiTrafficInput = {
  projectId: string;
  startDate?: string;
  endDate?: string;
  /** Top landing pages to return (default 25). */
  limit?: number;
};

type ReportRow = Record<string, string | number | null>;

const OTHER_ASSISTANT = "Other AI assistant";

function metric(row: ReportRow | undefined, name: string): number {
  const value = row?.[name];
  return typeof value === "number" ? value : 0;
}

/** Sum sessions by assistant name: several sources (chatgpt.com, openai) map to one. */
function rollUpAssistants(rows: ReportRow[]) {
  const byAssistant = new Map<
    string,
    { sessions: number; engagedSessions: number; keyEvents: number }
  >();
  for (const row of rows) {
    const source =
      typeof row.sessionSource === "string" ? row.sessionSource : "";
    // Rows that matched only GA4's AI Assistant channel group have no known name.
    const name = aiAssistantForSource(source) ?? OTHER_ASSISTANT;
    const total = byAssistant.get(name) ?? {
      sessions: 0,
      engagedSessions: 0,
      keyEvents: 0,
    };
    total.sessions += metric(row, "sessions");
    total.engagedSessions += metric(row, "engagedSessions");
    total.keyEvents += metric(row, "keyEvents");
    byAssistant.set(name, total);
  }
  const assistants = [...byAssistant.entries()].map(([assistant, total]) => ({
    assistant,
    ...total,
    engagementRate:
      total.sessions > 0 ? total.engagedSessions / total.sessions : 0,
  }));
  assistants.sort((a, b) => b.sessions - a.sessions);
  return assistants;
}

async function getAiTraffic(
  input: Ga4AiTrafficInput,
  opts: { now?: Date } = {},
) {
  const connection = await Ga4ConnectionRepository.getByProjectId(
    input.projectId,
  );
  if (!connection) {
    throw new Ga4ReportError(
      "ga4_not_connected",
      "Google Analytics is not connected for this project.",
    );
  }
  const dateRange = resolveGa4DateRange(
    input,
    connection.propertyTimeZone,
    opts.now,
  );
  const previousDateRange = previousPeriod(dateRange.resolvedDateRange);
  const client = createGa4DataClient({
    userId: connection.connectedByUserId,
    ga4AccountId: connection.ga4AccountId,
    propertyId: connection.propertyId,
  });
  const run = async (
    slice: Ga4AiTrafficSlice,
    range: { startDate: string; endDate: string },
    limit?: number,
  ) => {
    const request = buildGa4AiTrafficRequest({ ...range, slice, limit });
    return normalizeGa4Response(await client.runReport(request), request);
  };
  const current = dateRange.resolvedDateRange;

  try {
    const reports = await Promise.all([
      run("total", current),
      run("total", previousDateRange),
      run("all_sessions", current),
      run("assistant", current),
      run("landing_page", current, input.limit ?? 25),
      run("daily", current),
    ]);
    const [total, previousTotal, allTotal, assistants, landingPages, daily] =
      reports;
    const sessions = metric(total.rows[0], "sessions");
    const allSessions = metric(allTotal.rows[0], "sessions");
    const engagedSessions = metric(total.rows[0], "engagedSessions");
    const hasLimitedData = reports.some(
      (report) => report.reportMetadata.hasLimitedData,
    );
    return {
      status: "ok" as const,
      source: {
        provider: "google_analytics" as const,
        propertyId: connection.propertyId,
        propertyDisplayName: connection.propertyDisplayName,
      },
      request: {
        requestedDateRange: dateRange.requestedDateRange,
        resolvedDateRange: dateRange.resolvedDateRange,
        previousDateRange,
        propertyTimeZone: connection.propertyTimeZone,
      },
      totals: {
        sessions,
        engagedSessions,
        engagementRate: sessions > 0 ? engagedSessions / sessions : 0,
        keyEvents: metric(total.rows[0], "keyEvents"),
        allSessions,
        shareOfSessions: allSessions > 0 ? sessions / allSessions : null,
      },
      comparison: {
        sessions: comparisonValue(
          sessions,
          metric(previousTotal.rows[0], "sessions"),
        ),
      },
      assistants: rollUpAssistants(assistants.rows),
      landingPages: landingPages.rows,
      daily: daily.rows,
      reportMetadata: {
        hasLimitedData,
        reports: reports.map((report) => report.reportMetadata),
      },
      quota: daily.quota ?? total.quota,
      warnings: dateRange.warnings,
    };
  } catch (error) {
    mapGa4ReportError(error);
  }
}

export const Ga4AiTrafficService = { getAiTraffic };
