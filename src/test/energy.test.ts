import { describe, expect, it } from "vitest";
import { BUSINESS_TYPES } from "@/lib/business";
import { estimateOutageLoss, unitsStatus, zescoCommercialMonthlyCost } from "@/lib/energy";

describe("outage loss", () => {
  it("salon loses only profit, no spoilage", () => {
    const r = estimateOutageLoss(3, BUSINESS_TYPES.salon.loss, 200, 10000);
    expect(r.lostProfit).toBe(600);
    expect(r.spoilage).toBe(0);
  });

  it("butchery stock starts spoiling after 4 hours", () => {
    const before = estimateOutageLoss(4, BUSINESS_TYPES.butchery.loss, 100, 10000);
    const after = estimateOutageLoss(6, BUSINESS_TYPES.butchery.loss, 100, 10000);
    expect(before.spoilage).toBe(0);
    expect(after.spoilage).toBeCloseTo(2400);
  });
});

describe("units status", () => {
  it("is critical below 20 units", () => {
    expect(unitsStatus(15, 0.1)).toBe("critical");
  });
  it("is warning when under 12 hours remain", () => {
    expect(unitsStatus(100, 10)).toBe("warning");
  });
  it("is safe with plenty of units", () => {
    expect(unitsStatus(300, 2)).toBe("safe");
  });
});

describe("ZESCO commercial tariff", () => {
  it("charges 400 kWh across C1-C3 bands", () => {
    // 100*0.92 + 200*1.58 + 100*2.63
    expect(zescoCommercialMonthlyCost(400)).toBeCloseTo(671);
  });
});
