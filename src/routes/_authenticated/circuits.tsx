import { createFileRoute } from "@tanstack/react-router";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Power, ShieldCheck } from "lucide-react";
import { ConnectionNotice, PageHeader, Panel } from "@/components/dashboard-bits";
import { Switch } from "@/components/ui/switch";
import { useProfile } from "@/hooks/use-profile";
import { getBusiness, PRIORITY_LABEL, type Priority } from "@/lib/business";
import { matchCircuits, shedOrder as orderToShed } from "@/lib/circuits";
import { formatKwacha } from "@/lib/energy";
import { useTelemetry } from "@/lib/telemetry";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/circuits")({
  head: () => ({
    meta: [
      { title: "Circuits — PowerPulse" },
      { name: "description", content: "Live draw, priority and on/off control for every circuit on your board." },
      { property: "og:title", content: "Circuits — PowerPulse" },
      { property: "og:description", content: "Every breaker on your board, live." },
    ],
  }),
  component: Circuits,
});

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--primary-strong)"];
const PRIORITY_TONE: Record<Priority, string> = {
  1: "bg-primary-soft text-accent-foreground",
  2: "bg-muted text-foreground",
  3: "bg-sun-soft text-foreground",
};

function Circuits() {
  const profile = useProfile();
  const business = getBusiness(profile.business_type);
  const t = useTelemetry();
  // Show exactly the circuits the meter reports; fall back to the business's list until it does.
  const rows = matchCircuits(business.circuits, t.latest?.circuits);
  const fromMeter = Boolean(t.latest?.circuits.length);
  const total = Math.max(1, rows.reduce((s, c) => s + (c.reading?.power_w ?? 0), 0));
  const tariff = Number(profile.tariff_per_kwh);

  const pieData = rows.map((c) => ({ name: c.name, value: Math.round(c.reading?.power_w ?? 0) }));
  const shedOrder = orderToShed(rows);

  return (
    <>
      <PageHeader title="Circuits" subtitle={fromMeter ? `${rows.length} circuits reported live by your meter` : `${rows.length} circuits set up for ${business.label.toLowerCase()} · waiting for the meter`} />
      <ConnectionNotice />
      <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map((c, i) => {
            const r = c.reading;
            const off = t.offCircuits.includes(c.id) || r?.on === false;
            const w = r?.power_w ?? 0;
            return (
              <Panel key={c.id} className={cn("transition-all", off && "opacity-60")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="size-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    <div>
                      <h3 className="font-semibold">{c.name}</h3>
                      <span className={cn("mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold", PRIORITY_TONE[c.priority])}>
                        {PRIORITY_LABEL[c.priority]}
                      </span>
                    </div>
                  </div>
                  <Switch checked={!off} onCheckedChange={(v) => t.toggleCircuit(c.id, v)} aria-label={`Switch ${c.name}`} />
                </div>
                <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                  <Metric label="Power" value={`${Math.round(w)}`} unit="W" />
                  <Metric label="Current" value={(r?.current_a ?? 0).toFixed(1)} unit="A" />
                  <Metric label="Share" value={`${Math.round((w / total) * 100)}`} unit="%" />
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{c.ratedW ? `Rated ${c.ratedW.toLocaleString()} W` : r ? "Live from meter" : "No reading yet"}</span>
                  <span>≈ {formatKwacha((w / 1000) * tariff, 2)} / hour</span>
                </div>
              </Panel>
            );
          })}
        </div>

        <div className="space-y-6">
          <Panel>
            <h2 className="text-lg font-semibold">Where the power goes now</h2>
            <div className="h-56">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2} isAnimationActive={false}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="var(--card)" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
                    formatter={(v: number) => `${v} W`}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-1.5 text-sm">
              {pieData.map((d, i) => (
                <li key={d.name} className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="flex-1 truncate">{d.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{d.value} W</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Power className="size-4 text-primary" /> Load-shedding order
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              On a generator or small backup, switch off from the top. Keep the critical ones running.
            </p>
            <ol className="mt-4 space-y-2">
              {shedOrder.map((c, i) => (
                <li key={c.id} className="flex items-center gap-3 rounded-xl bg-muted/60 px-3 py-2 text-sm">
                  <span className="font-mono text-xs text-muted-foreground">{i + 1}</span>
                  <span className="flex-1">{c.name}</span>
                  {c.priority === 1 ? (
                    <ShieldCheck className="size-4 text-primary" />
                  ) : (
                    <span className="text-xs text-muted-foreground">{c.priority === 3 ? "Off first" : "If needed"}</span>
                  )}
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </>
  );
}

function Metric({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-xl bg-muted/60 px-2 py-2.5">
      <p className="font-mono text-lg font-semibold tabular">
        {value}
        <span className="ml-0.5 text-xs text-muted-foreground">{unit}</span>
      </p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
