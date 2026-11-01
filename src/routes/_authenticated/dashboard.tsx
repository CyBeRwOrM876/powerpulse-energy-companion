import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, Bell, Bot, Coins, Gauge, Info, Plug, Sparkles, Zap } from "lucide-react";
import { ConnectionNotice, PageHeader, Panel, StatCard, StatusBadge } from "@/components/dashboard-bits";
import { LiveChart } from "@/components/live-chart";
import { TopUpButton } from "@/components/top-up";
import { Switch } from "@/components/ui/switch";
import { useProfile } from "@/hooks/use-profile";
import { getBusiness, PRIORITY_LABEL } from "@/lib/business";
import { matchCircuits } from "@/lib/circuits";
import { formatHours, formatKwacha, hoursOfUnitsLeft } from "@/lib/energy";
import { useTelemetry } from "@/lib/telemetry";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — PowerPulse" },
      { name: "description", content: "Live load, prepaid units, today's cost and circuit status for your business." },
      { property: "og:title", content: "Dashboard — PowerPulse" },
      { property: "og:description", content: "Live electricity overview for your business." },
    ],
  }),
  component: Dashboard,
});

const SUGGESTIONS = [
  "Which circuit is costing me the most today?",
  "How long will my units last?",
  "What should I switch off during load-shedding?",
];

function Dashboard() {
  const profile = useProfile();
  const business = getBusiness(profile.business_type);
  const t = useTelemetry();
  const kw = t.latest?.power_kw ?? 0;
  const hrs = hoursOfUnitsLeft(t.unitsLeft, t.avgKw);
  const rows = matchCircuits(business.circuits, t.latest?.circuits);
  const circuits = rows.map((r) => ({ id: r.id, name: r.name, priority: r.priority, power_w: r.reading?.power_w ?? 0 }));
  const maxW = Math.max(1, ...rows.map((r) => Math.max(r.ratedW ?? 0, r.reading?.power_w ?? 0)));

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <>
      <PageHeader
        title={`${greet}${profile.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}`}
        subtitle={`${business.emoji} ${profile.business_name || business.label} · live electricity overview`}
        actions={<TopUpButton />}
      />
      <ConnectionNotice />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Live load"
          value={kw.toFixed(2)}
          unit="kW"
          icon={<Zap className="size-4" />}
          hint={t.latest ? `${t.latest.voltage.toFixed(0)} V supply` : "No reading yet"}
        />
        <StatCard
          label="Units left"
          value={t.unitsLeft.toFixed(1)}
          unit="kWh"
          tone={t.status === "safe" ? "success" : t.status === "warning" ? "warning" : "danger"}
          icon={<Gauge className="size-4" />}
          hint={
            <span className="flex items-center gap-2">
              <StatusBadge status={t.status} /> ~{formatHours(hrs)} at this rate
            </span>
          }
        />
        <StatCard
          label="Used today"
          value={t.kwhToday.toFixed(2)}
          unit="kWh"
          tone="sun"
          icon={<Plug className="size-4" />}
          hint={`Avg ${t.avgKw.toFixed(2)} kW`}
        />
        <StatCard
          label="Cost today"
          value={formatKwacha(t.costToday, 2)}
          tone="primary"
          icon={<Coins className="size-4" />}
          hint={`At K${Number(profile.tariff_per_kwh).toFixed(2)} per kWh`}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Panel>
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Live load</h2>
              <p className="text-xs text-muted-foreground">Updates every 2 seconds · 1 s on the meter counts as {t.speed / 60} min of use</p>
            </div>
            <span className="font-mono text-sm font-semibold text-primary">{kw.toFixed(2)} kW</span>
          </div>
          <LiveChart data={t.series} />
        </Panel>

        <Panel className="flex flex-col">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Circuits</h2>
            <Link to="/circuits" className="text-sm font-medium text-primary hover:underline">
              Details
            </Link>
          </div>
          <ul className="flex-1 space-y-3">
            {circuits.map((c) => {
              const def = c;
              const off = t.offCircuits.includes(c.id);
              return (
                <li key={c.id} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate font-medium">{c.name}</span>
                      <span className="font-mono text-xs tabular text-muted-foreground">{Math.round(c.power_w)} W</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-700",
                          def?.priority === 1 ? "bg-primary" : def?.priority === 2 ? "bg-chart-3" : "bg-chart-2",
                        )}
                        style={{ width: `${Math.min(100, (c.power_w / maxW) * 100)}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">{PRIORITY_LABEL[def.priority]}</p>
                  </div>
                  <Switch checked={!off} onCheckedChange={(v) => t.toggleCircuit(c.id, v)} aria-label={`Switch ${c.name}`} />
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel className="relative overflow-hidden">
          <div className="absolute -right-10 -top-10 size-40 rounded-full bg-sun-soft blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-gradient-sun text-foreground shadow-soft">
                <Bot className="size-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold">Ask ZedBot</h2>
                <p className="text-xs text-muted-foreground">Answers from your live readings</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {SUGGESTIONS.map((q) => (
                <Link
                  key={q}
                  to="/zedbot"
                  search={{ q }}
                  className="group flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm transition-colors hover:border-primary/50 hover:bg-primary-soft"
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="size-4 text-primary" /> {q}
                  </span>
                  <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </Link>
              ))}
            </div>
          </div>
        </Panel>

        <Panel>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Bell className="size-4 text-primary" /> Alerts
            </h2>
            {t.alerts.length > 0 && (
              <button onClick={t.clearAlerts} className="text-xs font-medium text-muted-foreground hover:text-foreground">
                Clear
              </button>
            )}
          </div>
          {t.alerts.length === 0 ? (
            <p className="rounded-xl bg-muted/60 px-4 py-6 text-center text-sm text-muted-foreground">
              All quiet. Unusual draws, outages and low units will show here.
            </p>
          ) : (
            <ul className="max-h-64 space-y-2 overflow-auto pr-1">
              {t.alerts.map((a) => (
                <li
                  key={a.id}
                  className={cn(
                    "flex items-start gap-3 rounded-xl px-3 py-2.5 text-sm",
                    a.level === "critical" ? "bg-danger-soft" : a.level === "warning" ? "bg-warning-soft" : "bg-muted",
                  )}
                >
                  {a.level === "info" ? (
                    <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <AlertTriangle className={cn("mt-0.5 size-4 shrink-0", a.level === "critical" ? "text-danger" : "text-warning")} />
                  )}
                  <span className="flex-1">{a.message}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {new Date(a.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
