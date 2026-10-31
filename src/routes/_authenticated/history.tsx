import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Panel, StatCard } from "@/components/dashboard-bits";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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

const tooltipStyle = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 };

function HistoryPage() {
  const profile = useProfile();
  const qc = useQueryClient();
  const [range, setRange] = useState<RangeKey>("24h");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["readings", range],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("readings")
        .select("id,created_at,total_kw,voltage,kwh_today,units_left,circuits,source")
        .eq("user_id", profile.id)
        .gte("created_at", new Date(Date.now() - RANGES[range]).toISOString())
        .order("created_at", { ascending: true })
        .limit(1000);
      if (error) throw error;
      return data;
    },
    refetchInterval: 30_000,
  });

  const chart = rows.map((r) => ({ t: new Date(r.created_at).getTime(), kw: Number(r.total_kw), units: Number(r.units_left) }));
  const avg = rows.length ? rows.reduce((s, r) => s + Number(r.total_kw), 0) / rows.length : 0;
  const peak = rows.reduce((m, r) => Math.max(m, Number(r.total_kw)), 0);
  const used = rows.length > 1 ? Math.max(0, Number(rows[0].units_left) - Number(rows[rows.length - 1].units_left)) : 0;
  const fmt = (t: number) =>
    range === "7d"
      ? new Date(t).toLocaleDateString([], { weekday: "short", hour: "2-digit" })
      : new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  function exportCsv() {
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
    const blob = new Blob([header + body], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `powerpulse-readings-${range}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function clearAll() {
    const { error } = await supabase.from("readings").delete().eq("user_id", profile.id);
    if (error) return toast.error(error.message);
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
            <ToggleGroup type="single" value={range} onValueChange={(v) => v && setRange(v as RangeKey)} className="rounded-xl border border-border bg-card p-1">
              {(Object.keys(RANGES) as RangeKey[]).map((k) => (
                <ToggleGroupItem key={k} value={k} className="rounded-lg px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                  {k}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <Button variant="outline" onClick={exportCsv} disabled={!rows.length}>
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
        <StatCard label="Average load" value={avg.toFixed(2)} unit="kW" icon={<Activity className="size-4" />} hint={`${rows.length} readings`} />
        <StatCard label="Peak load" value={peak.toFixed(2)} unit="kW" tone="sun" icon={<TrendingUp className="size-4" />} />
        <StatCard label="Units used" value={used.toFixed(1)} unit="kWh" tone="success" icon={<Gauge className="size-4" />} hint="Across this period (top-ups excluded)" />
      </div>

      {isLoading ? (
        <Panel className="mt-6 h-80 animate-pulse" />
      ) : rows.length === 0 ? (
        <Panel className="mt-6 py-16 text-center">
          <p className="font-semibold">No readings in this period yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Keep the dashboard open while the meter is sending data.</p>
        </Panel>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Panel>
            <h2 className="text-lg font-semibold">Load over time</h2>
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
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={(t: number) => new Date(t).toLocaleString()} formatter={(v: number) => [`${v.toFixed(2)} kW`, "Load"]} />
                  <Area type="monotone" dataKey="kw" stroke="var(--chart-1)" strokeWidth={2} fill="url(#hFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Panel>
            <h2 className="text-lg font-semibold">Units left</h2>
            <div className="mt-4 h-72">
              <ResponsiveContainer>
                <LineChart data={chart} margin={{ left: -18, right: 6 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="t" tickFormatter={fmt} stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} minTickGap={50} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={60} />
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={(t: number) => new Date(t).toLocaleString()} formatter={(v: number) => [`${v.toFixed(1)} kWh`, "Units"]} />
                  <Line type="monotone" dataKey="units" stroke="var(--chart-2)" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Panel className="lg:col-span-2">
            <h2 className="text-lg font-semibold">Latest readings</h2>
            <div className="mt-3 overflow-x-auto">
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
            </div>
          </Panel>
        </div>
      )}
    </>
  );
}
