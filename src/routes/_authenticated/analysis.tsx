import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Coins, Gauge, TrendingUp, Zap } from "lucide-react";
import { PageHeader, Panel, StatCard } from "@/components/dashboard-bits";
import { OutageCost } from "@/components/outage-cost";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useProfile } from "@/hooks/use-profile";
import { useCircuitUsage, useUsageBuckets } from "@/hooks/use-usage";
import { formatKwacha } from "@/lib/energy";
import {
  BUCKET_OF,
  bucketKeys,
  bucketTick,
  percentChange,
  periodLabel,
  periodRange,
  shiftAnchor,
  VIEW_LABEL,
  type View,
} from "@/lib/periods";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/analysis")({
  validateSearch: (s) => z.object({ tab: z.enum(["usage", "outage"]).optional() }).parse(s),
  head: () => ({
    meta: [
      { title: "Analysis — PowerPulse" },
      { name: "description", content: "How much electricity your business used by day, week, month and year — and what it cost." },
      { property: "og:title", content: "Analysis — PowerPulse" },
      { property: "og:description", content: "Electricity used and cost by day, week, month and year." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Analysis,
});

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--primary-strong)"];
const tooltipStyle = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 };

function Analysis() {
  const { tab = "usage" } = Route.useSearch();
  const navigate = useNavigate({ from: "/analysis" });
  return (
    <>
      <PageHeader title="Analysis" subtitle="How much electricity your business uses, what it costs, and what a power cut would cost" />
      <Tabs value={tab} onValueChange={(v) => navigate({ search: { tab: v as "usage" | "outage" }, replace: true })}>
        <TabsList className="mb-6 h-11 rounded-xl p-1">
          <TabsTrigger value="usage" className="rounded-lg px-4">Electricity used</TabsTrigger>
          <TabsTrigger value="outage" className="rounded-lg px-4">Outage cost</TabsTrigger>
        </TabsList>
        <TabsContent value="usage">
          <Usage />
        </TabsContent>
        <TabsContent value="outage">
          <OutageCost />
        </TabsContent>
      </Tabs>
    </>
  );
}

function Usage() {
  const profile = useProfile();
  const tariff = Number(profile.tariff_per_kwh);
  const [view, setView] = useState<View>("day");
  const [anchor, setAnchor] = useState(() => new Date());
  const bucket = BUCKET_OF[view];
  const { from, to } = useMemo(() => periodRange(view, anchor), [view, anchor]);
  const prev = useMemo(() => periodRange(view, shiftAnchor(view, anchor, -1)), [view, anchor]);
  const isCurrent = new Date() >= from && new Date() < to;

  const cur = useUsageBuckets(from, to, bucket);
  const before = useUsageBuckets(prev.from, prev.to, view === "year" ? "month" : "day");
  const circuits = useCircuitUsage(from, to);

  const rows = cur.data ?? [];
  const byKey = new Map(rows.map((r) => [r.bucket, r]));
  const chart = bucketKeys(bucket, from, to).map((k) => ({ k, kwh: byKey.get(k)?.kwh ?? 0 }));
  const total = rows.reduce((s, r) => s + r.kwh, 0);
  const prevTotal = (before.data ?? []).reduce((s, r) => s + r.kwh, 0);
  const change = percentChange(total, prevTotal);
  const n = rows.reduce((s, r) => s + r.readings, 0);
  const avgKw = n ? rows.reduce((s, r) => s + r.avg_kw * r.readings, 0) / n : 0;
  const peakKw = rows.reduce((m, r) => Math.max(m, r.peak_kw), 0);
  const busiest = chart.reduce<{ k: string; kwh: number } | null>((m, c) => (c.kwh > (m?.kwh ?? 0) ? c : m), null);

  const circuitRows = circuits.data ?? [];
  const circuitSum = circuitRows.reduce((s, c) => s + c.avg_w, 0);
  const split = circuitRows.map((c) => ({ ...c, kwh: circuitSum ? (c.avg_w / circuitSum) * total : 0 }));
  const unitWord = bucket === "hour" ? "hour" : bucket === "day" ? "day" : "month";

  return (
    <>
      <Panel className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(v) => v && setView(v as View)}
          className="rounded-xl border border-border bg-card p-1"
        >
          {(Object.keys(VIEW_LABEL) as View[]).map((v) => (
            <ToggleGroupItem key={v} value={v} className="rounded-lg px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
              {VIEW_LABEL[v]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Previous period" onClick={() => setAnchor((a) => shiftAnchor(view, a, -1))}>
            <ChevronLeft />
          </Button>
          <span className="min-w-44 text-center font-semibold">{periodLabel(view, anchor)}</span>
          <Button variant="outline" size="icon" aria-label="Next period" disabled={isCurrent} onClick={() => setAnchor((a) => shiftAnchor(view, a, 1))}>
            <ChevronRight />
          </Button>
          {!isCurrent && (
            <Button variant="ghost" size="sm" onClick={() => setAnchor(new Date())}>
              Now
            </Button>
          )}
        </div>
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Electricity used"
          value={total.toFixed(2)}
          unit="kWh"
          icon={<Zap className="size-4" />}
          hint={
            change === null ? (
              "No earlier period to compare"
            ) : (
              <span className={cn("inline-flex items-center gap-1 font-medium", change > 0 ? "text-warning" : "text-success")}>
                {change > 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                {Math.abs(change).toFixed(0)}% vs previous {view}
              </span>
            )
          }
        />
        <StatCard label="Cost" value={formatKwacha(total * tariff, 2)} tone="sun" icon={<Coins className="size-4" />} hint={`At K${tariff.toFixed(2)} per kWh`} />
        <StatCard label="Average load" value={avgKw.toFixed(2)} unit="kW" tone="success" icon={<Activity className="size-4" />} hint={`${n.toLocaleString()} saved readings`} />
        <StatCard
          label="Peak load"
          value={peakKw.toFixed(2)}
          unit="kW"
          tone="warning"
          icon={<TrendingUp className="size-4" />}
          hint={busiest && busiest.kwh > 0 ? `Busiest ${unitWord}: ${bucketTick(bucket, view, busiest.k)}` : "—"}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        <Panel>
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">kWh per {unitWord}</h2>
            <span className="text-xs text-muted-foreground">{periodLabel(view, anchor)}</span>
          </div>
          <div className="mt-4 h-80">
            {cur.isLoading ? (
              <div className="h-full animate-pulse rounded-xl bg-muted/60" />
            ) : (
              <ResponsiveContainer>
                <BarChart data={chart} margin={{ left: -14, right: 6 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="k"
                    tickFormatter={(k: string) => bucketTick(bucket, view, k)}
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                    minTickGap={8}
                  />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={56} />
                  <Tooltip
                    cursor={{ fill: "var(--muted)" }}
                    contentStyle={tooltipStyle}
                    labelFormatter={(k: string) =>
                      bucket === "hour"
                        ? new Date(k).toLocaleString([], { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })
                        : bucket === "day"
                          ? new Date(k).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })
                          : new Date(k).toLocaleDateString([], { month: "long", year: "numeric" })
                    }
                    formatter={(v: number) => [`${v.toFixed(2)} kWh · ${formatKwacha(v * tariff, 2)}`, "Used"]}
                  />
                  <Bar dataKey="kwh" fill="var(--chart-1)" radius={[6, 6, 0, 0]} maxBarSize={44} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          {!cur.isLoading && total === 0 && (
            <p className="mt-2 text-center text-sm text-muted-foreground">
              No electricity recorded in this period. Readings are saved while the dashboard is open and the meter is sending data.
            </p>
          )}
        </Panel>

        <Panel>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Gauge className="size-4 text-primary" /> Where it went
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Share of this period's electricity by circuit</p>
          {split.length === 0 ? (
            <p className="mt-6 rounded-xl bg-muted/60 px-4 py-6 text-center text-sm text-muted-foreground">No circuit data yet</p>
          ) : (
            <ul className="mt-5 space-y-4">
              {split.map((c, i) => {
                const pct = circuitSum ? (c.avg_w / circuitSum) * 100 : 0;
                return (
                  <li key={c.name}>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="truncate font-medium">{c.name}</span>
                      </span>
                      <span className="shrink-0 font-mono text-xs tabular text-muted-foreground">
                        {c.kwh.toFixed(2)} kWh · {formatKwacha(c.kwh * tariff)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
