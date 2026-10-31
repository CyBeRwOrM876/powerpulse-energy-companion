import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BatteryCharging, Bot, Clock, Package, TrendingDown, ZapOff } from "lucide-react";
import { PageHeader, Panel, StatCard } from "@/components/dashboard-bits";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useProfile } from "@/hooks/use-profile";
import { getBusiness } from "@/lib/business";
import { estimateOutageLoss, formatHours, formatKwacha } from "@/lib/energy";
import { useTelemetry } from "@/lib/telemetry";

export const Route = createFileRoute("/_authenticated/loss")({
  head: () => ({
    meta: [
      { title: "Loss Analysis — PowerPulse" },
      { name: "description", content: "What a power outage costs your business in lost profit and spoiled stock." },
      { property: "og:title", content: "Loss Analysis — PowerPulse" },
      { property: "og:description", content: "Outage cost in Kwacha for your type of business." },
    ],
  }),
  component: Loss,
});

function Loss() {
  const profile = useProfile();
  const business = getBusiness(profile.business_type);
  const t = useTelemetry();
  const [hours, setHours] = useState(3);
  const profit = Number(profile.profit_per_hour);
  const stock = Number(profile.stock_value);
  const r = estimateOutageLoss(hours, business.loss, profit, stock);

  const curve = useMemo(
    () =>
      [1, 2, 3, 4, 6, 8, 10, 12].map((h) => {
        const x = estimateOutageLoss(h, business.loss, profit, stock);
        return { h: `${h}h`, profit: Math.round(x.lostProfit), stock: Math.round(x.spoilage) };
      }),
    [business, profit, stock],
  );

  // Critical load = priority-1 circuits, using live draw when available.
  const live = new Map((t.latest?.circuits ?? []).map((c) => [c.id, c.power_w]));
  const criticalKw =
    business.circuits
      .filter((c) => c.priority === 1)
      .reduce((s, c) => s + (live.get(c.id) ?? c.ratedW * 0.6), 0) / 1000;
  const batteryKwh = (criticalKw * hours) / 0.8 / 0.9;

  return (
    <>
      <PageHeader
        title="Loss Analysis"
        subtitle={`What an outage costs a ${business.label.toLowerCase()} like yours`}
        actions={
          <>
            <Button variant="outline" onClick={() => t.simulateOutage(30)} disabled={Boolean(t.outage)}>
              <ZapOff /> Simulate 30 s outage
            </Button>
            <Button asChild variant="hero">
              <Link to="/zedbot" search={{ q: `How can I reduce my loss during a ${hours} hour power cut?` }}>
                <Bot /> Ask ZedBot
              </Link>
            </Button>
          </>
        }
      />

      {t.outage && (
        <Panel className="mb-6 border-danger/40 bg-danger-soft">
          <p className="text-sm font-semibold text-danger">Live outage</p>
          <p className="mt-1 font-mono text-4xl font-bold tabular">{formatKwacha(t.outage.loss)}</p>
          <p className="text-sm text-muted-foreground">lost so far after {formatHours(t.outage.simHours)} without power</p>
        </Panel>
      )}

      <Panel>
        <div className="flex flex-col gap-6 md:flex-row md:items-center">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">Outage length</p>
            <p className="font-display text-4xl font-bold">{hours} hours</p>
            <Slider className="mt-4" min={0.5} max={12} step={0.5} value={[hours]} onValueChange={(v) => setHours(v[0])} />
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>30 min</span>
              <span>12 hours</span>
            </div>
          </div>
          <div className="rounded-2xl bg-gradient-primary px-8 py-6 text-primary-foreground shadow-glow md:min-w-72">
            <p className="text-sm opacity-90">Estimated total loss</p>
            <p className="font-mono text-4xl font-bold tabular">{formatKwacha(r.total)}</p>
            <p className="mt-1 text-xs opacity-80">{formatKwacha(r.total / hours)} per hour on average</p>
          </div>
        </div>
      </Panel>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Lost profit" value={formatKwacha(r.lostProfit)} icon={<TrendingDown className="size-4" />} tone="warning" hint={`${Math.round(business.loss.revenueDependency * 100)}% of K${profit}/h depends on power`} />
        <StatCard
          label="Spoiled stock"
          value={formatKwacha(r.spoilage)}
          icon={<Package className="size-4" />}
          tone="danger"
          hint={
            business.loss.spoilageStartHours === null
              ? "No perishable stock for this business type"
              : `Starts after ${business.loss.spoilageStartHours} h · stock value ${formatKwacha(stock)}`
          }
        />
        <StatCard
          label="Backup to ride it out"
          value={batteryKwh.toFixed(1)}
          unit="kWh"
          icon={<BatteryCharging className="size-4" />}
          tone="success"
          hint={`Battery for ${criticalKw.toFixed(2)} kW of critical load`}
        />
      </div>

      <Panel className="mt-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Clock className="size-4 text-primary" /> How the loss grows
        </h2>
        <div className="mt-4 h-72">
          <ResponsiveContainer>
            <BarChart data={curve} margin={{ left: -10, right: 6 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="h" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `K${v}`} />
              <Tooltip
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
                formatter={(v: number, n: string) => [formatKwacha(v), n === "profit" ? "Lost profit" : "Spoiled stock"]}
              />
              <Bar dataKey="profit" stackId="a" fill="var(--chart-2)" radius={[0, 0, 4, 4]} />
              <Bar dataKey="stock" stackId="a" fill="var(--chart-4)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Based on your profit per hour and stock value in Settings. Estimates support decisions; they are not exact.
        </p>
      </Panel>
    </>
  );
}
