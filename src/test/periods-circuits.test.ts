import { describe, expect, it } from "vitest";
import { bucketKeys, periodRange, percentChange, shiftAnchor } from "@/lib/periods";
import { guessPriority, matchCircuits, shedOrder } from "@/lib/circuits";
import { getBusiness } from "@/lib/business";

describe("periods", () => {
  it("weeks start on Monday", () => {
    const { from, to } = periodRange("week", new Date(2026, 10, 1)); // Sunday 1 Nov 2026
    expect(from.getDay()).toBe(1);
    expect(from.getDate()).toBe(26);
    expect(from.getMonth()).toBe(9);
    expect((to.getTime() - from.getTime()) / 864e5).toBeCloseTo(7, 0);
  });

  it("a day view has 24 hourly bars, a year view 12 monthly bars", () => {
    const day = periodRange("day", new Date(2026, 10, 1, 15));
    expect(bucketKeys("hour", day.from, day.to)).toHaveLength(24);
    const year = periodRange("year", new Date(2026, 5, 9));
    expect(bucketKeys("month", year.from, year.to)).toHaveLength(12);
  });

  it("a month view has one bar per calendar day", () => {
    const feb = periodRange("month", new Date(2028, 1, 10));
    expect(bucketKeys("day", feb.from, feb.to)).toHaveLength(29);
  });

  it("moving back one month from January lands in December of the previous year", () => {
    const prev = shiftAnchor("month", new Date(2026, 0, 15), -1);
    expect(prev.getFullYear()).toBe(2025);
    expect(prev.getMonth()).toBe(11);
  });

  it("percent change needs a previous value", () => {
    expect(percentChange(12, 10)).toBeCloseTo(20);
    expect(percentChange(5, 0)).toBeNull();
  });
});

describe("circuits from the meter", () => {
  const butchery = getBusiness("butchery");

  it("shows the meter's own circuits even when ids differ from the business list", () => {
    const rows = matchCircuits(butchery.circuits, [
      { id: "ac", name: "Air Conditioning", current_a: 8.7, power_w: 1999, on: true },
      { id: "refrigeration", name: "Refrigeration", current_a: 1.3, power_w: 302, on: true },
    ]);
    expect(rows.map((r) => r.name)).toEqual(["Air Conditioning", "Refrigeration"]);
    expect(rows[0]?.reading?.power_w).toBe(1999);
  });

  it("falls back to the business list before the meter sends anything", () => {
    expect(matchCircuits(butchery.circuits, [])).toHaveLength(butchery.circuits.length);
  });

  it("keeps refrigeration on and sheds air conditioning first", () => {
    expect(guessPriority("Refrigeration")).toBe(1);
    expect(guessPriority("Air Conditioning")).toBe(3);
    const order = shedOrder(
      matchCircuits([], [
        { id: "r", name: "Refrigeration", current_a: 1, power_w: 300, on: true },
        { id: "ac", name: "Air Conditioning", current_a: 8, power_w: 2000, on: true },
      ]),
    );
    expect(order[0]?.name).toBe("Air Conditioning");
  });
});
