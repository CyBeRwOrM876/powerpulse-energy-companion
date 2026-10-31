// In-browser demo meter. Mirrors the load patterns in the ESP32 firmware so demo data
// looks the same as data coming from the physical board.
import type { CircuitDef, LoadPattern } from "./business";
import type { Telemetry } from "./telemetry-types";

interface SimCircuit extends CircuitDef {
  on: boolean;
  active: boolean;
  timer: number; // simulated minutes until state flip (cycling/burst)
  spike: number; // ticks of unusual draw left
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export class DemoMeter {
  private circuits: SimCircuit[];
  private energy = 0;
  private uptime = 0;
  private outageLeft = 0;
  constructor(
    defs: CircuitDef[],
    private device: string,
    public speed = 60,
    offIds: string[] = [],
  ) {
    this.circuits = defs.map((d) => ({
      ...d,
      on: !offIds.includes(d.id),
      active: Math.random() > 0.5,
      timer: rand(2, 12),
      spike: 0,
    }));
  }

  setOn(id: string, on: boolean) {
    const c = this.circuits.find((x) => x.id === id);
    if (c) c.on = on;
  }

  triggerOutage(seconds: number) {
    this.outageLeft = Math.max(0, seconds);
  }

  /** Simulated hour of day; the simulated day starts at 08:00. */
  private simHour() {
    return (8 + (this.uptime * this.speed) / 3600) % 24;
  }

  private factor(c: SimCircuit, simMinutes: number): number {
    const h = this.simHour();
    const open = h >= 7 && h < 19;
    const p: LoadPattern = c.pattern;
    if (p === "cycling" || p === "burst") {
      c.timer -= simMinutes;
      if (c.timer <= 0) {
        c.active = p === "cycling" ? !c.active : Math.random() < (open ? 0.55 : 0.1);
        c.timer = c.active ? rand(p === "cycling" ? 10 : 4, p === "cycling" ? 18 : 15) : rand(6, 20);
      }
      return c.active ? rand(0.82, 1) : p === "cycling" ? rand(0.03, 0.07) : rand(0, 0.02);
    }
    if (p === "steady") return rand(0.7, 0.85);
    if (p === "peak") {
      const curve = h >= 7 && h <= 19 ? Math.sin((Math.PI * (h - 7)) / 12) : 0;
      return Math.min(1, 0.12 + 0.85 * Math.max(0, curve) + rand(-0.05, 0.05));
    }
    // lighting
    return h >= 6 && h < 21 ? rand(0.85, 0.95) : rand(0.2, 0.3);
  }

  tick(dtSec: number): Telemetry {
    this.uptime += dtSec;
    const simMinutes = (dtSec * this.speed) / 60;
    const outage = this.outageLeft > 0;
    if (outage) this.outageLeft = Math.max(0, this.outageLeft - dtSec);
    const voltage = outage ? 0 : 230 + rand(-4, 4);

    let alert: string | null = null;
    if (!outage && Math.random() < 0.015) {
      const candidates = this.circuits.filter((c) => c.on);
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      if (pick) pick.spike = 3;
    }

    let totalW = 0;
    const circuits = this.circuits.map((c) => {
      let w = 0;
      if (!outage && c.on) {
        w = c.ratedW * this.factor(c, simMinutes);
        if (c.spike > 0) {
          w *= 1.65;
          c.spike -= 1;
          alert = c.id;
        }
      }
      totalW += w;
      return {
        id: c.id,
        name: c.name,
        power_w: Math.round(w),
        current_a: voltage > 0 ? Number((w / voltage).toFixed(2)) : 0,
        on: c.on,
      };
    });

    this.energy += ((totalW / 1000) * dtSec * this.speed) / 3600;
    return {
      device: this.device,
      voltage: Number(voltage.toFixed(1)),
      power_kw: Number((totalW / 1000).toFixed(3)),
      energy_kwh: Number(this.energy.toFixed(4)),
      uptime_s: Math.round(this.uptime),
      speed: this.speed,
      outage,
      alert,
      circuits,
    };
  }
}
