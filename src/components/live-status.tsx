import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useTelemetry } from "@/lib/telemetry";

export function useLiveLabel() {
  const t = useTelemetry();
  if (t.source === "demo") return { label: "Demo data", tone: "sun" as const };
  if (t.receiving) return { label: "Live", tone: "success" as const };
  if (t.connection === "connected") return { label: "Waiting for meter", tone: "warning" as const };
  if (t.connection === "connecting") return { label: "Connecting…", tone: "muted" as const };
  return { label: "Offline", tone: "danger" as const };
}

const TONES = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  sun: "bg-sun-soft text-foreground",
  muted: "bg-muted text-muted-foreground",
};

export function LiveStatusPill() {
  const { label, tone } = useLiveLabel();
  return (
    <Link
      to="/settings"
      className={cn(
        "hidden items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold sm:inline-flex",
        TONES[tone],
      )}
    >
      <span className={cn("size-2 rounded-full bg-current", tone === "success" && "pulse-dot")} />
      {label}
    </Link>
  );
}
