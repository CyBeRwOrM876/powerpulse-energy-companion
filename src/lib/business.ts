// Business types, their typical circuits and outage-loss profiles.
// Shared by the dashboard, the demo simulator, the meter config sent over MQTT and ZedBot.

export type LoadPattern = "cycling" | "steady" | "peak" | "burst" | "lighting";
export type Priority = 1 | 2 | 3;

export interface CircuitDef {
  id: string;
  name: string;
  /** Rated power in watts when fully running */
  ratedW: number;
  pattern: LoadPattern;
  /** 1 = critical (never shed), 2 = important, 3 = sheddable */
  priority: Priority;
}

export interface LossProfile {
  /** Share of hourly profit lost while power is off (0-1) */
  revenueDependency: number;
  /** Hours of outage before stock starts to spoil (null = no perishable stock) */
  spoilageStartHours: number | null;
  /** Fraction of stock value lost per hour once spoilage starts */
  spoilageRatePerHour: number;
  /** Maximum fraction of stock that can be lost */
  maxSpoilage: number;
}

export interface BusinessType {
  id: BusinessTypeId;
  label: string;
  emoji: string;
  blurb: string;
  circuits: CircuitDef[];
  loss: LossProfile;
}

export const BUSINESS_TYPE_IDS = [
  "butchery",
  "supermarket",
  "pharmacy",
  "bakery",
  "restaurant",
  "hotel",
  "salon",
  "welding",
  "hammermill",
  "office",
  "retail",
] as const;

export type BusinessTypeId = (typeof BUSINESS_TYPE_IDS)[number];

export const BUSINESS_TYPES: Record<BusinessTypeId, BusinessType> = {
  butchery: {
    id: "butchery",
    label: "Butchery",
    emoji: "🥩",
    blurb: "Cold rooms, display fridges and mincers",
    circuits: [
      { id: "c1", name: "Cold room", ratedW: 2200, pattern: "cycling", priority: 1 },
      { id: "c2", name: "Display fridges", ratedW: 900, pattern: "cycling", priority: 1 },
      { id: "c3", name: "Meat mincer & saw", ratedW: 1500, pattern: "burst", priority: 2 },
      { id: "c4", name: "POS & lighting", ratedW: 350, pattern: "lighting", priority: 1 },
      { id: "c5", name: "Air conditioner", ratedW: 1400, pattern: "peak", priority: 3 },
    ],
    loss: { revenueDependency: 0.9, spoilageStartHours: 4, spoilageRatePerHour: 0.12, maxSpoilage: 0.85 },
  },
  supermarket: {
    id: "supermarket",
    label: "Supermarket / Grocery",
    emoji: "🛒",
    blurb: "Freezers, chillers, tills and lights",
    circuits: [
      { id: "c1", name: "Freezers", ratedW: 2400, pattern: "cycling", priority: 1 },
      { id: "c2", name: "Dairy chillers", ratedW: 1600, pattern: "cycling", priority: 1 },
      { id: "c3", name: "Tills & POS", ratedW: 500, pattern: "steady", priority: 1 },
      { id: "c4", name: "Shop lighting", ratedW: 900, pattern: "lighting", priority: 2 },
      { id: "c5", name: "Air conditioning", ratedW: 2800, pattern: "peak", priority: 3 },
      { id: "c6", name: "Bakery corner oven", ratedW: 3000, pattern: "burst", priority: 3 },
    ],
    loss: { revenueDependency: 0.8, spoilageStartHours: 5, spoilageRatePerHour: 0.06, maxSpoilage: 0.5 },
  },
  pharmacy: {
    id: "pharmacy",
    label: "Pharmacy",
    emoji: "💊",
    blurb: "Vaccine fridges, POS and lighting",
    circuits: [
      { id: "c1", name: "Medicine fridge", ratedW: 300, pattern: "cycling", priority: 1 },
      { id: "c2", name: "POS & computers", ratedW: 400, pattern: "steady", priority: 1 },
      { id: "c3", name: "Lighting", ratedW: 450, pattern: "lighting", priority: 2 },
      { id: "c4", name: "Air conditioner", ratedW: 1200, pattern: "peak", priority: 2 },
    ],
    loss: { revenueDependency: 0.6, spoilageStartHours: 6, spoilageRatePerHour: 0.05, maxSpoilage: 0.3 },
  },
  bakery: {
    id: "bakery",
    label: "Bakery",
    emoji: "🥖",
    blurb: "Ovens, mixers and proofers",
    circuits: [
      { id: "c1", name: "Deck oven", ratedW: 6000, pattern: "burst", priority: 1 },
      { id: "c2", name: "Dough mixer", ratedW: 2200, pattern: "burst", priority: 1 },
      { id: "c3", name: "Proofer", ratedW: 1200, pattern: "steady", priority: 2 },
      { id: "c4", name: "Display & lights", ratedW: 400, pattern: "lighting", priority: 2 },
      { id: "c5", name: "Extractor fans", ratedW: 600, pattern: "peak", priority: 3 },
    ],
    loss: { revenueDependency: 0.95, spoilageStartHours: 1, spoilageRatePerHour: 0.25, maxSpoilage: 0.7 },
  },
  restaurant: {
    id: "restaurant",
    label: "Restaurant / Bar",
    emoji: "🍽️",
    blurb: "Kitchen, bar fridges, sound and lights",
    circuits: [
      { id: "c1", name: "Kitchen appliances", ratedW: 3500, pattern: "peak", priority: 1 },
      { id: "c2", name: "Bar fridges", ratedW: 1100, pattern: "cycling", priority: 1 },
      { id: "c3", name: "Freezer", ratedW: 700, pattern: "cycling", priority: 1 },
      { id: "c4", name: "Lighting & sound", ratedW: 900, pattern: "lighting", priority: 2 },
      { id: "c5", name: "Air conditioning", ratedW: 2400, pattern: "peak", priority: 3 },
    ],
    loss: { revenueDependency: 0.9, spoilageStartHours: 4, spoilageRatePerHour: 0.08, maxSpoilage: 0.6 },
  },
  hotel: {
    id: "hotel",
    label: "Hotel / Lodge",
    emoji: "🏨",
    blurb: "Rooms, water heaters, kitchen and laundry",
    circuits: [
      { id: "c1", name: "Water heaters", ratedW: 6000, pattern: "peak", priority: 2 },
      { id: "c2", name: "Kitchen & cold room", ratedW: 3200, pattern: "cycling", priority: 1 },
      { id: "c3", name: "Room sockets & lights", ratedW: 2500, pattern: "lighting", priority: 2 },
      { id: "c4", name: "Laundry", ratedW: 3500, pattern: "burst", priority: 3 },
      { id: "c5", name: "Reception, Wi-Fi & CCTV", ratedW: 400, pattern: "steady", priority: 1 },
      { id: "c6", name: "Pool & water pump", ratedW: 1500, pattern: "burst", priority: 3 },
    ],
    loss: { revenueDependency: 0.5, spoilageStartHours: 5, spoilageRatePerHour: 0.05, maxSpoilage: 0.4 },
  },
  salon: {
    id: "salon",
    label: "Salon / Barbershop",
    emoji: "💈",
    blurb: "Dryers, clippers, water heater and lights",
    circuits: [
      { id: "c1", name: "Hair dryers", ratedW: 3200, pattern: "burst", priority: 1 },
      { id: "c2", name: "Clippers & tools", ratedW: 300, pattern: "burst", priority: 1 },
      { id: "c3", name: "Water heater", ratedW: 2000, pattern: "peak", priority: 2 },
      { id: "c4", name: "Lights & music", ratedW: 350, pattern: "lighting", priority: 2 },
      { id: "c5", name: "Air conditioner", ratedW: 1200, pattern: "peak", priority: 3 },
    ],
    loss: { revenueDependency: 1, spoilageStartHours: null, spoilageRatePerHour: 0, maxSpoilage: 0 },
  },
  welding: {
    id: "welding",
    label: "Welding / Metal Workshop",
    emoji: "🔧",
    blurb: "Welders, grinders and compressors",
    circuits: [
      { id: "c1", name: "Arc welder", ratedW: 7000, pattern: "burst", priority: 1 },
      { id: "c2", name: "Angle grinders", ratedW: 2400, pattern: "burst", priority: 2 },
      { id: "c3", name: "Air compressor", ratedW: 2200, pattern: "cycling", priority: 2 },
      { id: "c4", name: "Workshop lights", ratedW: 400, pattern: "lighting", priority: 3 },
    ],
    loss: { revenueDependency: 1, spoilageStartHours: null, spoilageRatePerHour: 0, maxSpoilage: 0 },
  },
  hammermill: {
    id: "hammermill",
    label: "Agro / Hammer Mill",
    emoji: "🌽",
    blurb: "Hammer mill motor, dehuller and lights",
    circuits: [
      { id: "c1", name: "Hammer mill motor", ratedW: 11000, pattern: "burst", priority: 1 },
      { id: "c2", name: "Dehuller", ratedW: 4000, pattern: "burst", priority: 2 },
      { id: "c3", name: "Grain conveyor", ratedW: 1500, pattern: "burst", priority: 3 },
      { id: "c4", name: "Lights & office", ratedW: 300, pattern: "lighting", priority: 2 },
    ],
    loss: { revenueDependency: 1, spoilageStartHours: null, spoilageRatePerHour: 0, maxSpoilage: 0 },
  },
  office: {
    id: "office",
    label: "Office / Agency",
    emoji: "🏢",
    blurb: "Computers, printers, AC and servers",
    circuits: [
      { id: "c1", name: "Computers", ratedW: 1500, pattern: "peak", priority: 1 },
      { id: "c2", name: "Server & network", ratedW: 450, pattern: "steady", priority: 1 },
      { id: "c3", name: "Printers & copier", ratedW: 1200, pattern: "burst", priority: 2 },
      { id: "c4", name: "Lighting", ratedW: 600, pattern: "lighting", priority: 2 },
      { id: "c5", name: "Air conditioning", ratedW: 2400, pattern: "peak", priority: 3 },
      { id: "c6", name: "Kitchen & kettle", ratedW: 2000, pattern: "burst", priority: 3 },
    ],
    loss: { revenueDependency: 0.7, spoilageStartHours: null, spoilageRatePerHour: 0, maxSpoilage: 0 },
  },
  retail: {
    id: "retail",
    label: "Retail Shop",
    emoji: "🏪",
    blurb: "Drinks fridge, POS, lights and signage",
    circuits: [
      { id: "c1", name: "Drinks fridge", ratedW: 450, pattern: "cycling", priority: 1 },
      { id: "c2", name: "POS & mobile money", ratedW: 200, pattern: "steady", priority: 1 },
      { id: "c3", name: "Shop lighting", ratedW: 500, pattern: "lighting", priority: 2 },
      { id: "c4", name: "Signage", ratedW: 300, pattern: "lighting", priority: 3 },
      { id: "c5", name: "Fan / AC", ratedW: 900, pattern: "peak", priority: 3 },
    ],
    loss: { revenueDependency: 0.7, spoilageStartHours: 6, spoilageRatePerHour: 0.03, maxSpoilage: 0.2 },
  },
};

export const BUSINESS_LIST = BUSINESS_TYPE_IDS.map((id) => BUSINESS_TYPES[id]);

export function getBusiness(id: string | null | undefined): BusinessType {
  if (id && id in BUSINESS_TYPES) return BUSINESS_TYPES[id as BusinessTypeId];
  return BUSINESS_TYPES.retail;
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  1: "Critical",
  2: "Important",
  3: "Can switch off",
};
