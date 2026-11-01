import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Bucket } from "@/lib/periods";

export interface UsageBucket {
  bucket: string;
  kwh: number;
  avg_kw: number;
  peak_kw: number;
  avg_v: number;
  units_left: number;
  readings: number;
}

const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Lusaka";

/** Saved readings grouped into hours / days / weeks / months in the browser's time zone. */
export function useUsageBuckets(from: Date, to: Date, bucket: Bucket | "week", enabled = true) {
  return useQuery({
    queryKey: ["usage-buckets", from.toISOString(), to.toISOString(), bucket],
    enabled,
    refetchInterval: 60_000,
    queryFn: async (): Promise<UsageBucket[]> => {
      const { data, error } = await supabase.rpc("reading_buckets", {
        p_from: from.toISOString(),
        p_to: to.toISOString(),
        p_bucket: bucket,
        p_tz: tz(),
      });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        bucket: r.bucket,
        kwh: Number(r.kwh ?? 0),
        avg_kw: Number(r.avg_kw ?? 0),
        peak_kw: Number(r.peak_kw ?? 0),
        avg_v: Number(r.avg_v ?? 0),
        units_left: Number(r.units_left ?? 0),
        readings: Number(r.readings ?? 0),
      }));
    },
  });
}

export function useCircuitUsage(from: Date, to: Date) {
  return useQuery({
    queryKey: ["circuit-usage", from.toISOString(), to.toISOString()],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("circuit_usage", { p_from: from.toISOString(), p_to: to.toISOString() });
      if (error) throw error;
      return (data ?? []).map((r) => ({ name: r.name ?? "Circuit", avg_w: Number(r.avg_w ?? 0), peak_w: Number(r.peak_w ?? 0) }));
    },
  });
}

/** Year of the first saved reading, so year pickers only list years that can have data. */
export function useFirstReadingYear(userId: string) {
  return useQuery({
    queryKey: ["first-reading-year", userId],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("readings")
        .select("created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      return data ? new Date(data.created_at).getFullYear() : new Date().getFullYear();
    },
  });
}
