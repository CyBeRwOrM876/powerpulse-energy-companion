// Reference dataset ZedBot uses alongside the business's own readings.
// Keep figures sourced or clearly marked as typical/rule-of-thumb values.

export const ZESCO_TARIFFS = {
  source: "ZESCO tariff schedule (zesco.co.zm/tariff), ERB Multi-Year Tariff framework, 1 Nov 2025 – 31 Oct 2027",
  note: "Commercial customers up to 15 kVA. Bands apply to monthly consumption; each band is charged at its own rate.",
  commercial: [
    { band: "C1", range: "0–100 kWh", nov2025: 0.66, preApproved2026_27: 0.92 },
    { band: "C2", range: "101–300 kWh", nov2025: 1.35, preApproved2026_27: 1.58 },
    { band: "C3", range: "301–500 kWh", nov2025: 2.19, preApproved2026_27: 2.63 },
    { band: "C4", range: "above 500 kWh", nov2025: 3.16, preApproved2026_27: 3.16 },
  ],
  residentialForComparison: [
    { band: "R1", range: "0–100 kWh", preApproved2026_27: 0.54 },
    { band: "R2", range: "100–200 kWh", preApproved2026_27: 1.28 },
    { band: "R3", range: "200–400 kWh", preApproved2026_27: 2.83 },
    { band: "R4", range: "400+ kWh", preApproved2026_27: 4.04 },
  ],
  maximumDemand: "Large users above 15 kVA move to Maximum Demand (MD1–MD4) tariffs with kVA demand charges.",
};

export const GRID_CONTEXT = [
  "Zambia gets most of its electricity from hydropower (Kariba, Kafue Gorge, Itezhi-Tezhi). The 2023/24 drought cut water at Kariba and caused severe load-shedding in 2024–2025, often 12+ hours a day in many areas.",
  "Load-shedding schedules are published by ZESCO by area and can change at short notice; businesses should plan for unannounced outages too.",
  "Power returning after an outage can arrive with voltage surges; surge protection and staggered restart of motors/compressors reduce damage and inrush peaks.",
  "Prepaid meters cut supply instantly when units reach zero — at night this is as harmful as an outage.",
  "Nominal supply is 230 V single-phase / 400 V three-phase at 50 Hz. Sustained voltage below ~200 V stresses motors and compressors.",
];

export const APPLIANCE_REFERENCE = [
  { appliance: "Chest freezer (300–500 L)", typicalW: "150–300", dutyCycle: "40–60%", kwhPerDay: "1.5–3" },
  { appliance: "Commercial cold room (small)", typicalW: "1,500–3,000", dutyCycle: "50–70%", kwhPerDay: "20–45" },
  { appliance: "Display fridge (glass door)", typicalW: "300–600", dutyCycle: "50–70%", kwhPerDay: "4–9" },
  { appliance: "Split air conditioner 12,000 BTU", typicalW: "1,000–1,400", dutyCycle: "50–80% in hot hours", kwhPerDay: "6–12 (8 h use)" },
  { appliance: "Electric deck oven (bakery)", typicalW: "5,000–9,000", dutyCycle: "batches", kwhPerDay: "25–50" },
  { appliance: "Dough mixer", typicalW: "1,500–3,000", dutyCycle: "short bursts", kwhPerDay: "3–8" },
  { appliance: "Hair dryer / blow dryer", typicalW: "1,200–2,200", dutyCycle: "per client", kwhPerDay: "3–10" },
  { appliance: "Arc welder (inverter)", typicalW: "3,000–8,000", dutyCycle: "20–60%", kwhPerDay: "10–30" },
  { appliance: "Hammer mill motor 15 hp", typicalW: "11,000", dutyCycle: "while milling", kwhPerDay: "40–90" },
  { appliance: "Electric geyser 150 L", typicalW: "2,000–3,000", dutyCycle: "heating cycles", kwhPerDay: "6–12" },
  { appliance: "Desktop PC + monitor", typicalW: "100–250", dutyCycle: "office hours", kwhPerDay: "1–2" },
  { appliance: "Laser printer / copier", typicalW: "400–1,500 when printing", dutyCycle: "low", kwhPerDay: "1–3" },
  { appliance: "LED tube 18 W vs fluorescent 36 W", typicalW: "18 vs 36", dutyCycle: "lighting hours", kwhPerDay: "LED saves ~50%" },
  { appliance: "POS terminal / router / CCTV", typicalW: "20–80 each", dutyCycle: "24 h", kwhPerDay: "0.5–2" },
];

export const SAVING_PLAYBOOK = [
  "Refrigeration: keep doors shut, check door seals (a paper-strip test), clean condenser coils monthly, leave 10 cm airflow behind units, don't load hot product, set cold rooms to 0–4 °C (chill) or −18 °C (frozen), not colder.",
  "Air conditioning: set 24–25 °C, close doors/windows, service filters monthly; each 1 °C warmer saves roughly 6–8% of AC energy.",
  "Lighting: switch to LED and use daylight; turn signage off after closing or put it on a timer.",
  "Motors (mills, welders, compressors): avoid running idle, fix air leaks on compressors, stagger start-ups to avoid tripping breakers.",
  "Water heating: insulate geysers and pipes, use a timer, consider solar water heating.",
  "Shift heavy, flexible loads (baking batches, milling, laundry, welding jobs) to hours when supply is available and away from known load-shedding slots.",
  "Prepaid units: top up before weekends/holidays and when hours-of-units-left drops under one business day.",
];

export const BACKUP_RULES = [
  "Battery sizing: battery kWh ≈ critical load kW × hours of backup ÷ depth of discharge (0.8 lithium, 0.5 lead-acid) ÷ inverter efficiency (~0.9).",
  "Inverter sizing: at least 1.25 × the total running kW of loads on backup; motors and compressors can surge to 3× their running power on start.",
  "Solar PV: Zambia averages about 5–6 peak sun hours per day. PV kWp ≈ daily kWh to cover ÷ (peak sun hours × 0.75 system losses).",
  "Only put critical circuits (cold chain, POS, security, network) on backup; heavy heating and AC loads make systems very expensive.",
  "Generators: small petrol generators burn very roughly 0.4–0.6 L per kWh at part load; diesel is more efficient (~0.3 L/kWh). Use the latest ERB pump price for cost.",
  "Never back-feed a generator into the board without a changeover switch installed by a qualified electrician.",
];

export const BUSINESS_BENCHMARKS: Record<string, string> = {
  butchery: "Cold chain is 60–80% of energy. Meat in a closed cold room is usually safe ~4 h without power; spoilage risk rises quickly after that.",
  supermarket: "Refrigeration ~50–60%, lighting ~15–20%, HVAC the rest. Frozen stock in closed freezers holds ~24–48 h if doors stay shut; chillers far less.",
  pharmacy: "Vaccines/insulin need 2–8 °C; a fridge without power stays in range only a few hours if closed. Use a thermometer log.",
  bakery: "Ovens dominate (often 60%+). An outage mid-bake or mid-proof can ruin a whole batch within an hour.",
  restaurant: "Kitchen and refrigeration dominate; evening peaks. Outages during service hours lose most revenue.",
  hotel: "Water heating can be 30–40% of energy; laundry and kitchen next. Guests notice hot water and Wi-Fi first.",
  salon: "Dryers and water heaters dominate; revenue stops almost completely without power.",
  welding: "Welders draw heavy bursts; revenue depends on power ~100%. Batch jobs into supply windows.",
  hammermill: "One large motor is nearly all the load; running at full hopper is more efficient than idling.",
  office: "Computers, AC and lighting; servers and network are critical. A UPS for the router/server keeps work going.",
  retail: "Drinks fridge and lighting are the main loads; POS and mobile money must stay up.",
};

export function knowledgeAsText(): string {
  const t = ZESCO_TARIFFS;
  return [
    `## ZESCO tariffs (${t.source})`,
    t.note,
    "Commercial bands (K/kWh): " +
      t.commercial.map((b) => `${b.band} ${b.range}: K${b.preApproved2026_27} (2026/27), K${b.nov2025} (from Nov 2025)`).join("; "),
    "Residential for comparison (2026/27): " + t.residentialForComparison.map((b) => `${b.band} ${b.range}: K${b.preApproved2026_27}`).join("; "),
    t.maximumDemand,
    "## Grid context",
    ...GRID_CONTEXT.map((x) => `- ${x}`),
    "## Typical appliance loads (rule of thumb)",
    ...APPLIANCE_REFERENCE.map((a) => `- ${a.appliance}: ${a.typicalW} W, duty ${a.dutyCycle}, ${a.kwhPerDay} kWh/day`),
    "## Saving playbook",
    ...SAVING_PLAYBOOK.map((x) => `- ${x}`),
    "## Backup and solar sizing rules",
    ...BACKUP_RULES.map((x) => `- ${x}`),
    "## Business benchmarks",
    ...Object.entries(BUSINESS_BENCHMARKS).map(([k, v]) => `- ${k}: ${v}`),
  ].join("\n");
}
