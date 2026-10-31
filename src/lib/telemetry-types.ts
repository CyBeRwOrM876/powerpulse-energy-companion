import type { CircuitDef } from "./business";

/** One circuit inside a telemetry message from the meter (ESP32 or demo). */
export interface CircuitReading {
  id: string;
  name: string;
  current_a: number;
  power_w: number;
  on: boolean;
}

/** Message published by the meter on powerpulse/<device>/telemetry every ~2 s. */
export interface Telemetry {
  device: string;
  voltage: number;
  power_kw: number;
  /** Cumulative energy counter in kWh since the meter booted (time-accelerated by `speed`). */
  energy_kwh: number;
  uptime_s?: number;
  /** Simulated minutes per real second (60 = 1 real second counts as 1 minute). */
  speed?: number;
  outage?: boolean;
  /** Circuit id with an unusual draw, if any */
  alert?: string | null;
  circuits: CircuitReading[];
}

/** Retained config the dashboard publishes on powerpulse/<device>/config. */
export interface MeterConfig {
  business: string;
  speed: number;
  circuits: { id: string; name: string; w: number; p: CircuitDef["pattern"]; on: boolean }[];
}

/** Commands the dashboard publishes on powerpulse/<device>/cmd. */
export type MeterCommand = { id: string; on: boolean } | { outage_s: number };

export const DEFAULT_BROKER_WSS = "wss://broker.hivemq.com:8884/mqtt";
export const DEFAULT_BROKER_HOST = "broker.hivemq.com";

export function topicsFor(device: string) {
  const base = `powerpulse/${device}`;
  return {
    base,
    telemetry: `${base}/telemetry`,
    status: `${base}/status`,
    config: `${base}/config`,
    cmd: `${base}/cmd`,
  };
}

export function parseTelemetry(raw: string): Telemetry | null {
  try {
    const d = JSON.parse(raw) as Partial<Telemetry>;
    if (typeof d !== "object" || d === null) return null;
    if (typeof d.power_kw !== "number" || !Array.isArray(d.circuits)) return null;
    return {
      device: String(d.device ?? ""),
      voltage: Number(d.voltage ?? 0),
      power_kw: Number(d.power_kw),
      energy_kwh: Number(d.energy_kwh ?? 0),
      uptime_s: d.uptime_s,
      speed: typeof d.speed === "number" && d.speed > 0 ? d.speed : 60,
      outage: Boolean(d.outage),
      alert: d.alert ?? null,
      circuits: d.circuits.slice(0, 12).map((c) => ({
        id: String(c.id),
        name: String(c.name ?? c.id),
        current_a: Number(c.current_a ?? 0),
        power_w: Number(c.power_w ?? 0),
        on: c.on === undefined ? true : Boolean(c.on),
      })),
    };
  } catch {
    return null;
  }
}
