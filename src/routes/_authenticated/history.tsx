import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Panel, StatCard } from "@/components/dashboard-bits";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFirstReadingYear, useUsageBuckets } from "@/hooks/use-usage";
import { MONTHS } from "@/lib/periods";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useProfile } from "@/hooks/use-profile";
import { Activity, Gauge, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "History — PowerPulse" },
      { name: "description", content: "Saved electricity readings, load trends and units over time." },
      { property: "og:title", content: "History — PowerPulse" },
      { property: "og:description", content: "Your saved readings and trends." },
    ],
  }),
  component: HistoryPage,
});

const RANGES = { "1h": 3600e3, "24h": 864e5, "7d": 7 * 864e5 } as const;
type RangeKey = keyof typeof RANGES;
type FilterKey = RangeKey | "month" | "year";
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "1h", label: "1h" },
  { key: "24h", label: "24h" },
  { key: "7d", label: "7d" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
];

const tooltipStyle = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 };

function HistoryPage() {
  const profile = useProfile();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<FilterKey>("24h");
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());
  const firstYear = useFirstReadingYear(profile.id).data ?? new Date().getFullYear();
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: Math.max(1, thisYear - Math.min(firstYear, thisYear) + 1) }, (_, i) => thisYear - i);
  const isPeriod = filter === "month" || filter === "year";

  const period = useMemo(() => {
    if (filter === "month") return { from: new Date(year, month, 1), to: new Date(year, month + 1, 1) };
    return { from: new Date(year, 0, 1), to: new Date(year + 1, 0, 1) };
  }, [filter, year, month]);

  // Recent ranges: raw readings.
  const { data: rawRows = [], isLoading: rawLoading } = useQuery({
    queryKey: ["readings", filter],
    enabled: !isPeriod,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("readings")
        .select("id,created_at,total_kw,voltage,kwh_today,units_left,circuits,source")
        .eq("user_id", profile.id)
        .gte("created_at", new Date(Date.now() - RANGES[filter as RangeKey]).toISOString())
        .order("created_at", { ascending: true })
        .limit(1000);
      if (error) throw error;
      return data;
    },
    refetchInterval: 30_000,
  });
  const rows = isPeriod ? [] : rawRows;

  // Month / year: one summary per day.
  const days = useUsageBuckets(period.from, period.to, "day", isPeriod);
  const dayRows = isPeriod ? (days.data ?? []) : [];
  const isLoading = isPeriod ? days.isLoading : rawLoading;

  const chart = isPeriod
    ? dayRows.map((d) => ({ t: new Date(d.bucket).getTime(), kw: d.avg_kw, peak: d.peak_kw, units: d.units_left, kwh: d.kwh }))
    : rows.map((r) => ({ t: new Date(r.created_at).getTime(), kw: Number(r.total_kw), peak: Number(r.total_kw), units: Number(r.units_left), kwh: 0 }));
  const count = isPeriod ? dayRows.reduce((s, d) => s + d.readings, 0) : rows.length;
  const avg = isPeriod
    ? count ? dayRows.reduce((s, d) => s + d.avg_kw * d.readings, 0) / count : 0
    : rows.length ? rows.reduce((s, r) => s + Number(r.total_kw), 0) / rows.length : 0;
  const peak = isPeriod ? dayRows.reduce((m, d) => Math.max(m, d.peak_kw), 0) : rows.reduce((m, r) => Math.max(m, Number(r.total_kw)), 0);
  const used = isPeriod
    ? dayRows.reduce((s, d) => s + d.kwh, 0)
    : rows.length > 1 ? Math.max(0, Number(rows[0]?.units_left ?? 0) - Number(rows.at(-1)?.units_left ?? 0)) : 0;
  const hasData = isPeriod ? dayRows.length > 0 : rows.length > 0;
  const periodName = filter === "month" ? `${MONTHS[month]} ${year}` : filter === "year" ? String(year) : filter;
  const fmt = (t: number) =>
    filter === "year"
      ? new Date(t).toLocaleDateString([], { day: "numeric", month: "short" })
      : filter === "month"
        ? String(new Date(t).getDate())
        : filter === "7d"
          ? new Date(t).toLocaleDateString([], { weekday: "short", hour: "2-digit" })
          : new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const labelFmt = (t: number) => (isPeriod ? new Date(t).toLocaleDateString([], { weekday: "short", day: "numeric", month: "long", year: "numeric" }) : new Date(t).toLocaleString());

  function download(text: string, name: string) {
    const blob = new Blob([text], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function exportCsv() {
    if (isPeriod) {
      const header = "date,kwh_used,avg_kw,peak_kw,avg_voltage,units_left_end,readings\n";
      const body = dayRows.map((d) => [d.bucket.slice(0, 10), d.kwh, d.avg_kw, d.peak_kw, d.avg_v, d.units_left, d.readings].join(",")).join("\n");
      download(header + body, `powerpulse-daily-${periodName.replace(/\s+/g, "-").toLowerCase()}.csv`);
      return;
    }
    const header = "time,total_kw,voltage,kwh_today,units_left,source,circuits\n";
    const body = rows
      .map((r) =>
        [
          r.created_at,
          r.total_kw,
          r.voltage,
          r.kwh_today,
          r.units_left,
          r.source,
          `"${(Array.isArray(r.circuits) ? (r.circuits as { name: string; w: number }[]) : []).map((c) => `${c.name}:${c.w}W`).join("; ")}"`,
        ].join(","),
      )
      .join("\n");
    download(header + body, `powerpulse-readings-${filter}.csv`);
  }

  async function clearAll() {
    const { error } = await supabase.from("readings").delete().eq("user_id", profile.id);
    if (error) { toast.error(error.message); return; }
    toast.success("History cleared");
    qc.invalidateQueries({ queryKey: ["readings"] });
  }

  return (
    <>
      <PageHeader
        title="History"
        subtitle="A reading is saved every 30 seconds while your dashboard is open"
        actions={
          <>
            <ToggleGroup type="single" value={filter} onValueChange={(v) => v && setFilter(v as FilterKey)} className="rounded-xl border border-border bg-card p-1">
              {FILTERS.map((f) => (
                <ToggleGroupItem key={f.key} value={f.key} className="rounded-lg px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                  {f.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {filter === "month" && (
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger className="h-10 w-36 rounded-xl" aria-label="Month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={m} value={String(i)}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {isPeriod && (
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="h-10 w-28 rounded-xl" aria-label="Year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" onClick={exportCsv} disabled={!hasData}>
              <Download /> CSV
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Clear history" disabled={!rows.length}>
                  <Trash2 />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear all saved readings?</AlertDialogTitle>
                  <AlertDialogDescription>This removes your whole history. ZedBot will have less to learn from.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={clearAll}>Clear history</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Average load" value={avg.toFixed(2)} unit="kW" icon={<Activity className="size-4" />} hint={`${count.toLocaleString()} readings · ${periodName}`} />
        <StatCard label="Peak load" value={peak.toFixed(2)} unit="kW" tone="sun" icon={<TrendingUp className="size-4" />} />
        <StatCard label="Units used" value={used.toFixed(1)} unit="kWh" tone="success" icon={<Gauge className="size-4" />} hint={isPeriod ? `Total for ${periodName}` : "Across this period (top-ups excluded)"} />
      </div>

      {isLoading ? (
        <Panel className="mt-6 h-80 animate-pulse">{null}</Panel>
      ) : !hasData ? (
        <Panel className="mt-6 py-16 text-center">
          <p className="font-semibold">No readings for {periodName} yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Keep the dashboard open while the meter is sending data.</p>
        </Panel>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Panel>
            <h2 className="text-lg font-semibold">{isPeriod ? "Daily average load" : "Load over time"}</h2>
            <div className="mt-4 h-72">
              <ResponsiveContainer>
                <AreaChart data={chart} margin={{ left: -18, right: 6 }}>
                  <defs>
                    <linearGradient id="hFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="t" tickFormatter={fmt} stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} minTickGap={50} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} unit=" kW" width={60} />
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={labelFmt} formatter={(v: number) => [`${v.toFixed(2)} kW`, "Load"]} />
                  <Area type="monotone" dataKey="kw" stroke="var(--chart-1)" strokeWidth={2} fill="url(#hFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Panel>
            <h2 className="text-lg font-semibold">{isPeriod ? "Units left at end of day" : "Units left"}</h2>
            <div className="mt-4 h-72">
              <ResponsiveContainer>
                <LineChart data={chart} margin={{ left: -18, right: 6 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="t" tickFormatter={fmt} stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} minTickGap={50} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={60} />
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={labelFmt} formatter={(v: number) => [`${v.toFixed(1)} kWh`, "Units"]} />
                  <Line type="monotone" dataKey="units" stroke="var(--chart-2)" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Panel className="lg:col-span-2">
            <h2 className="text-lg font-semibold">{isPeriod ? `Day by day · ${periodName}` : "Latest readings"}</h2>
            <div className="mt-3 overflow-x-auto">
              {isPeriod ? (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Date</th>
                      <th className="py-2 pr-4 font-medium">Used</th>
                      <th className="py-2 pr-4 font-medium">Avg load</th>
                      <th className="py-2 pr-4 font-medium">Peak</th>
                      <th className="py-2 pr-4 font-medium">Voltage</th>
                      <th className="py-2 font-medium">Units left</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono text-xs">
                    {[...dayRows].reverse().map((d) => (
                      <tr key={d.bucket} className="border-t border-border">
                        <td className="py-2 pr-4">{new Date(d.bucket).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}</td>
                        <td className="py-2 pr-4">{d.kwh.toFixed(2)} kWh</td>
                        <td className="py-2 pr-4">{d.avg_kw.toFixed(2)} kW</td>
                        <td className="py-2 pr-4">{d.peak_kw.toFixed(2)} kW</td>
                        <td className="py-2 pr-4">{d.avg_v.toFixed(0)} V</td>
                        <td className="py-2">{d.units_left.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Time</th>
                    <th className="py-2 pr-4 font-medium">Load</th>
                    <th className="py-2 pr-4 font-medium">Voltage</th>
                    <th className="py-2 pr-4 font-medium">Today</th>
                    <th className="py-2 pr-4 font-medium">Units left</th>
                    <th className="py-2 font-medium">Source</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-xs">
                  {[...rows].reverse().slice(0, 15).map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="py-2 pr-4">{new Date(r.created_at).toLocaleString()}</td>
                      <td className="py-2 pr-4">{Number(r.total_kw).toFixed(2)} kW</td>
                      <td className="py-2 pr-4">{Number(r.voltage).toFixed(0)} V</td>
                      <td className="py-2 pr-4">{Number(r.kwh_today).toFixed(2)} kWh</td>
                      <td className="py-2 pr-4">{Number(r.units_left).toFixed(1)}</td>
                      <td className="py-2">{r.source === "demo" ? "Demo" : "Meter"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              )}
            </div>
          </Panel>
        </div>
      )}
    </>
  );
}
