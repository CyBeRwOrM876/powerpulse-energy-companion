// Calendar periods for the Analysis and History pages.
// Bucket keys are local wall-clock strings "YYYY-MM-DDTHH:00:00", matching the
// `bucket` column returned by the reading_buckets database function.

export type View = "day" | "week" | "month" | "year";
export type Bucket = "hour" | "day" | "month";

export const VIEW_LABEL: Record<View, string> = { day: "Daily", week: "Weekly", month: "Monthly", year: "Yearly" };
export const BUCKET_OF: Record<View, Bucket> = { day: "hour", week: "day", month: "day", year: "month" };

const pad = (n: number) => String(n).padStart(2, "0");

export function bucketKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00:00`;
}

/** Start (inclusive) and end (exclusive) of the period containing `anchor`. Weeks start on Monday. */
export function periodRange(view: View, anchor: Date): { from: Date; to: Date } {
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  const d = anchor.getDate();
  if (view === "day") return { from: new Date(y, m, d), to: new Date(y, m, d + 1) };
  if (view === "week") {
    const offset = (anchor.getDay() + 6) % 7; // Monday = 0
    return { from: new Date(y, m, d - offset), to: new Date(y, m, d - offset + 7) };
  }
  if (view === "month") return { from: new Date(y, m, 1), to: new Date(y, m + 1, 1) };
  return { from: new Date(y, 0, 1), to: new Date(y + 1, 0, 1) };
}

export function shiftAnchor(view: View, anchor: Date, dir: -1 | 1): Date {
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  const d = anchor.getDate();
  if (view === "day") return new Date(y, m, d + dir);
  if (view === "week") return new Date(y, m, d + 7 * dir);
  if (view === "month") return new Date(y, m + dir, 1);
  return new Date(y + dir, 0, 1);
}

/** Every bucket key inside [from, to), so empty hours/days/months still show as zero. */
export function bucketKeys(bucket: Bucket, from: Date, to: Date): string[] {
  const keys: string[] = [];
  const cur = new Date(from);
  while (cur < to && keys.length < 1000) {
    keys.push(bucketKey(cur));
    if (bucket === "hour") cur.setHours(cur.getHours() + 1);
    else if (bucket === "day") cur.setDate(cur.getDate() + 1);
    else cur.setMonth(cur.getMonth() + 1);
  }
  return keys;
}

export function periodLabel(view: View, anchor: Date): string {
  const { from, to } = periodRange(view, anchor);
  if (view === "day") return from.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  if (view === "week") {
    const last = new Date(to.getTime() - 864e5);
    return `${from.toLocaleDateString([], { day: "numeric", month: "short" })} – ${last.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}`;
  }
  if (view === "month") return from.toLocaleDateString([], { month: "long", year: "numeric" });
  return String(from.getFullYear());
}

export function bucketTick(bucket: Bucket, view: View, key: string): string {
  const d = new Date(key);
  if (bucket === "hour") return `${pad(d.getHours())}:00`;
  if (bucket === "month") return d.toLocaleDateString([], { month: "short" });
  if (view === "week") return d.toLocaleDateString([], { weekday: "short" });
  return String(d.getDate());
}

/** Percent change from previous to current; null when there is nothing to compare against. */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

export const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString([], { month: "long" }));
