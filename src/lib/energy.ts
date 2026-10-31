// Pure energy and money rules used across PowerPulse. Covered by src/test/energy.test.ts.
import type { LossProfile } from "./business";

export interface LossBreakdown {
  hours: number;
  lostProfit: number;
  spoilage: number;
  total: number;
}

/** Estimated Kwacha lost when power is off for `hours`. */
export function estimateOutageLoss(
  hours: number,
  profile: LossProfile,
  profitPerHour: number,
  stockValue: number,
): LossBreakdown {
  const h = Math.max(0, hours);
  const lostProfit = Math.max(0, profitPerHour) * h * profile.revenueDependency;
  let spoilage = 0;
  if (profile.spoilageStartHours !== null && h > profile.spoilageStartHours) {
    const frac = Math.min(profile.maxSpoilage, (h - profile.spoilageStartHours) * profile.spoilageRatePerHour);
    spoilage = Math.max(0, stockValue) * frac;
  }
  return { hours: h, lostProfit, spoilage, total: lostProfit + spoilage };
}

export type UnitsStatus = "safe" | "warning" | "critical";

/** Hours of prepaid units left at the current average draw. */
export function hoursOfUnitsLeft(unitsLeft: number, avgKw: number): number {
  if (avgKw <= 0.01) return Infinity;
  return Math.max(0, unitsLeft) / avgKw;
}

/**
 * Units status:
 * - critical: under 20 units, or under 4 hours left
 * - warning: under 75 units, or under 12 hours left
 * - safe otherwise
 */
export function unitsStatus(unitsLeft: number, avgKw: number): UnitsStatus {
  const hrs = hoursOfUnitsLeft(unitsLeft, avgKw);
  if (unitsLeft < 20 || hrs < 4) return "critical";
  if (unitsLeft < 75 || hrs < 12) return "warning";
  return "safe";
}

/** ZESCO commercial (C) tariff bands, K/kWh, 2026/2027 pre-approved schedule. */
export const ZESCO_COMMERCIAL_BANDS = [
  { upTo: 100, rate: 0.92, label: "C1 (0–100 kWh)" },
  { upTo: 300, rate: 1.58, label: "C2 (101–300 kWh)" },
  { upTo: 500, rate: 2.63, label: "C3 (301–500 kWh)" },
  { upTo: Infinity, rate: 3.16, label: "C4 (above 500 kWh)" },
] as const;

/** Cost in Kwacha of a month's consumption on the stepped commercial tariff. */
export function zescoCommercialMonthlyCost(kwh: number): number {
  let remaining = Math.max(0, kwh);
  let prev = 0;
  let cost = 0;
  for (const band of ZESCO_COMMERCIAL_BANDS) {
    const size = band.upTo - prev;
    const used = Math.min(remaining, size);
    cost += used * band.rate;
    remaining -= used;
    prev = band.upTo;
    if (remaining <= 0) break;
  }
  return cost;
}

export function formatKwacha(value: number, digits = 0): string {
  return `K${value.toLocaleString("en-ZM", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function formatHours(hours: number): string {
  if (!Number.isFinite(hours)) return "—";
  if (hours >= 48) return `${Math.round(hours / 24)} days`;
  if (hours >= 1) return `${hours.toFixed(1)} h`;
  return `${Math.round(hours * 60)} min`;
}
