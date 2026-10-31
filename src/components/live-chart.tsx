import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SeriesPoint } from "@/lib/telemetry";

export function LiveChart({ data, height = 260 }: { data: SeriesPoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 6, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="kwFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.45} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="t"
          tickFormatter={(t: number) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          stroke="var(--muted-foreground)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          minTickGap={60}
        />
        <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} unit=" kW" width={60} />
        <Tooltip
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            color: "var(--popover-foreground)",
            fontSize: 12,
          }}
          labelFormatter={(t: number) => new Date(t).toLocaleTimeString()}
          formatter={(v: number) => [`${v.toFixed(2)} kW`, "Load"]}
        />
        <Area
          type="monotone"
          dataKey="kw"
          stroke="var(--chart-1)"
          strokeWidth={2.5}
          fill="url(#kwFill)"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
