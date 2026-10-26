import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, XAxis, YAxis } from "recharts";
import { CardShell } from "@/client/components/CardShell";
import { SkeletonTableRows } from "@/client/components/SkeletonPresets";
import { Skeleton } from "@/client/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/client/components/ui/chart";
import { formatTrendDay } from "@/client/features/dashboard/Ga4Card";
import {
  formatCount,
  formatCtr,
} from "@/client/features/search-performance/SearchPerformanceColumns";
import { getGa4AiTrafficReport } from "@/serverFunctions/ga4";

const chartConfig = {
  sessions: { label: "Sessions", color: "var(--color-primary)" },
} satisfies ChartConfig;

/** Rendered only for connected projects; a dead grant leaves Ga4Card's connect card. */
export function Ga4AiTrafficCard({ projectId }: { projectId: string }) {
  const reportQuery = useQuery({
    queryKey: ["dashboardGa4AiTraffic", projectId],
    queryFn: () => getGa4AiTrafficReport({ data: { projectId } }),
  });
  const report = reportQuery.data;
  if (report && !report.connected) return null;

  return (
    <CardShell title="AI assistant traffic">
      <p className="mb-4 text-sm text-muted-foreground">
        Google Analytics · Last 28 days
      </p>
      {reportQuery.isError ? (
        <p className="text-sm text-muted-foreground">
          Couldn&rsquo;t load Google Analytics data. Try again shortly.
        </p>
      ) : !report ? (
        <div className="space-y-3" aria-busy>
          <SkeletonTableRows rows={4} columns={3} />
          <Skeleton className="h-24" />
        </div>
      ) : report.totals.sessions === 0 ? (
        <p className="text-sm text-muted-foreground">
          No sessions from AI assistants such as ChatGPT, Perplexity, Gemini or
          Claude recorded in the last 28 days yet.
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm">
            <span className="text-2xl font-semibold tabular-nums">
              {formatCount(report.totals.sessions)}
            </span>{" "}
            sessions
            {report.totals.shareOfSessions !== null && (
              <span className="text-muted-foreground">
                {" "}
                · {formatCtr(report.totals.shareOfSessions)} of all sessions
              </span>
            )}
            {report.comparison.percentChange !== null && (
              <span
                className={
                  report.comparison.percentChange >= 0
                    ? " text-success"
                    : " text-destructive"
                }
              >
                {" "}
                {report.comparison.percentChange > 0 ? "+" : ""}
                {Math.round(report.comparison.percentChange * 100)}% vs previous
                period
              </span>
            )}
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Assistant</TableHead>
                <TableHead className="text-right">Sessions</TableHead>
                <TableHead className="text-right">Engagement</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.assistants.map((assistant) => (
                <TableRow key={assistant.assistant}>
                  <TableCell>{assistant.assistant}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCount(assistant.sessions)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCtr(assistant.engagementRate)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Top landing pages</TableHead>
                <TableHead className="text-right">Sessions</TableHead>
                <TableHead className="text-right">Key events</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.landingPages.map((page) => (
                <TableRow key={`${page.host}${page.path}`}>
                  <TableCell className="max-w-48 truncate" title={page.path}>
                    {page.path}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCount(page.sessions)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {page.keyEvents === null
                      ? "—"
                      : formatCount(page.keyEvents)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <ChartContainer config={chartConfig} className="h-24">
            <AreaChart
              data={report.trend}
              margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
            >
              <XAxis dataKey="date" hide />
              <YAxis hide domain={[0, "auto"]} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(label: unknown) =>
                      typeof label === "string" ? formatTrendDay(label) : ""
                    }
                    valueFormatter={(value) => formatCount(Number(value))}
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="sessions"
                stroke="var(--color-sessions)"
                strokeWidth={2}
                fill="var(--color-sessions)"
                fillOpacity={0.08}
              />
            </AreaChart>
          </ChartContainer>
        </div>
      )}
    </CardShell>
  );
}
