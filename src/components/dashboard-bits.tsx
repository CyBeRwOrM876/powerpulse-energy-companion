import { Link } from "@tanstack/react-router";
import { CloudOff, Radio, ZapOff } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useTelemetry } from "@/lib/telemetry";
import { useProfile, useUpdateProfile } from "@/hooks/use-profile";
import { formatHours, formatKwacha } from "@/lib/energy";
import { Button } from "@/components/ui/button";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div className="animate-rise">
        <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1.5 text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-2xl border border-border bg-gradient-card p-5 shadow-soft", className)}>{children}</div>;
}

export function StatCard({
  label,
  value,
  unit,
  hint,
  icon,
  tone = "primary",
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: ReactNode;
  icon: ReactNode;
  tone?: "primary" | "sun" | "success" | "warning" | "danger";
}) {
  const tones = {
    primary: "bg-primary-soft text-primary",
    sun: "bg-sun-soft text-warning",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
  };
  return (
    <Panel className="relative overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lift">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span className={cn("grid size-9 place-items-center rounded-xl", tones[tone])}>{icon}</span>
      </div>
      <p className="mt-3 font-mono text-3xl font-semibold tabular">
        {value}
        {unit && <span className="ml-1 text-base font-medium text-muted-foreground">{unit}</span>}
      </p>
      {hint && <div className="mt-1.5 text-xs text-muted-foreground">{hint}</div>}
    </Panel>
  );
}

export function OutageBanner() {
  const t = useTelemetry();
  if (!t.outage) return null;
  return (
    <div className="border-b border-danger/30 bg-danger-soft">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 text-sm sm:px-6">
        <span className="grid size-8 place-items-center rounded-full bg-danger text-destructive-foreground">
          <ZapOff className="size-4" />
        </span>
        <p className="font-semibold text-danger">Power outage in progress</p>
        <p className="text-foreground">
          Off for <b className="font-mono">{formatHours(t.outage.simHours)}</b> · estimated loss so far{" "}
          <b className="font-mono">{formatKwacha(t.outage.loss)}</b>
        </p>
        <Link to="/analysis" search={{ tab: "outage" }} className="ml-auto font-semibold text-danger underline-offset-4 hover:underline">
          See outage cost
        </Link>
      </div>
    </div>
  );
}

/** Shown when the live meter is not sending data yet. */
export function ConnectionNotice() {
  const t = useTelemetry();
  const profile = useProfile();
  const update = useUpdateProfile();
  if (t.source === "demo" || t.receiving) return null;
  const connected = t.connection === "connected";
  return (
    <Panel className="mb-6 flex flex-col gap-4 border-warning/40 bg-warning-soft sm:flex-row sm:items-center">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-card text-warning shadow-soft">
        {connected ? <Radio className="size-5" /> : <CloudOff className="size-5" />}
      </span>
      <div className="flex-1">
        <p className="font-semibold">{connected ? "Waiting for your meter" : "Connecting to the meter network…"}</p>
        <p className="text-sm text-muted-foreground">
          Listening on <span className="font-mono text-foreground">powerpulse/{profile.device_id}/telemetry</span>. Power
          on the meter, or switch to demo data for a quick walk-through.
        </p>
      </div>
      <div className="flex gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to="/settings">Connection help</Link>
        </Button>
        <Button size="sm" variant="hero" disabled={update.isPending} onClick={() => update.mutate({ data_source: "demo" })}>
          Use demo data
        </Button>
      </div>
    </Panel>
  );
}

export function StatusBadge({ status }: { status: "safe" | "warning" | "critical" }) {
  const map = {
    safe: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    critical: "bg-danger-soft text-danger",
  };
  const label = { safe: "Safe", warning: "Warning", critical: "Critical" };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", map[status])}>
      <span className="size-1.5 rounded-full bg-current" /> {label[status]}
    </span>
  );
}
