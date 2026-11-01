// Joins the circuits the meter actually reports with the business's circuit list.
// A physical meter may use its own circuit ids and names, so the page shows what the
// meter sends and only borrows priority/rating from a matching business circuit.
import type { CircuitDef, Priority } from "./business";
import type { CircuitReading } from "./telemetry-types";

export interface CircuitRow {
  id: string;
  name: string;
  priority: Priority;
  ratedW: number | null;
  reading: CircuitReading | null;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Guess how critical a circuit is from its name when the business list has no match. */
export function guessPriority(name: string): Priority {
  const n = name.toLowerCase();
  if (/(fridge|freez|cold|refrig|chill|pos|till|security|alarm|server|router|vaccine|medic|incubat)/.test(n)) return 1;
  if (/(air ?con|\bac\b|^ac$|heater|heating|geyser|boiler|kettle|water heat|fan|tv|music|sign)/.test(n)) return 3;
  return 2;
}

export function matchCircuits(defs: CircuitDef[], live: CircuitReading[] | null | undefined): CircuitRow[] {
  if (!live || live.length === 0) {
    return defs.map((d) => ({ id: d.id, name: d.name, priority: d.priority, ratedW: d.ratedW, reading: null }));
  }
  return live.map((r) => {
    const def = defs.find((d) => d.id === r.id) ?? defs.find((d) => norm(d.name) === norm(r.name));
    return {
      id: r.id,
      name: r.name || def?.name || r.id,
      priority: def?.priority ?? guessPriority(r.name || r.id),
      ratedW: def && norm(def.name) === norm(r.name) ? def.ratedW : def && def.id === r.id && !r.name ? def.ratedW : null,
      reading: r,
    };
  });
}

/** Order to switch circuits off on a generator: least critical first, biggest first. */
export function shedOrder(rows: CircuitRow[]): CircuitRow[] {
  return [...rows].sort(
    (a, b) => b.priority - a.priority || (b.reading?.power_w ?? b.ratedW ?? 0) - (a.reading?.power_w ?? a.ratedW ?? 0),
  );
}
