// Live readings for the signed-in business.
// Source "mqtt": subscribes to the physical ESP32 through the MQTT broker (same broker MQTT Explorer shows).
// Source "demo": runs the in-browser DemoMeter with identical message shape.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getBusiness } from "./business";
import { DemoMeter } from "./simulator";
import { estimateOutageLoss, unitsStatus, type UnitsStatus } from "./energy";
import { parseTelemetry, topicsFor, type MeterCommand, type MeterConfig, type Telemetry } from "./telemetry-types";
import type { Profile } from "@/hooks/use-profile";

export type ConnectionState = "connecting" | "connected" | "error" | "demo";

export interface SeriesPoint {
  t: number;
  kw: number;
  v: number;
}

export interface AlertItem {
  id: string;
  t: number;
  level: "info" | "warning" | "critical";
  message: string;
}

export interface TelemetryState {
  source: "mqtt" | "demo";
  connection: ConnectionState;
  deviceOnline: boolean | null;
  lastSeen: number | null;
  receiving: boolean;
  latest: Telemetry | null;
  series: SeriesPoint[];
  kwhToday: number;
  costToday: number;
  unitsLeft: number;
  avgKw: number;
  status: UnitsStatus;
  alerts: AlertItem[];
  outage: { startedAt: number; simHours: number; loss: number } | null;
  speed: number;
  offCircuits: string[];
  toggleCircuit: (id: string, on: boolean) => void;
  simulateOutage: (seconds: number) => void;
  topUp: (units: number) => Promise<void>;
  clearAlerts: () => void;
}

const Ctx = createContext<TelemetryState | null>(null);

export function useTelemetry() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTelemetry must be used inside TelemetryProvider");
  return v;
}

const SERIES_MAX = 150;
const SAVE_EVERY_MS = 30_000;

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function TelemetryProvider({ profile, children }: { profile: Profile; children: ReactNode }) {
  const business = getBusiness(profile.business_type);
  const source: "mqtt" | "demo" = profile.data_source === "demo" ? "demo" : "mqtt";
  const device = profile.device_id || `pp-${profile.id.replace(/-/g, "").slice(0, 8)}`;
  const offKey = `pp-off-${profile.id}`;

  const [connection, setConnection] = useState<ConnectionState>(source === "demo" ? "demo" : "connecting");
  const [deviceOnline, setDeviceOnline] = useState<boolean | null>(null);
  const [latest, setLatest] = useState<Telemetry | null>(null);
  const [lastSeen, setLastSeen] = useState<number | null>(null);
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [kwhToday, setKwhToday] = useState(0);
  const [unitsLeft, setUnitsLeft] = useState(Number(profile.units_balance));
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [outageStart, setOutageStart] = useState<number | null>(null);
  const [offCircuits, setOffCircuits] = useState<string[]>([]);
  const [now, setNow] = useState(() => Date.now());

  const kwhRef = useRef(0);
  const unitsRef = useRef(Number(profile.units_balance));
  const lastEnergyRef = useRef<number | null>(null);
  const latestRef = useRef<Telemetry | null>(null);
  const clientRef = useRef<import("mqtt").MqttClient | null>(null);
  const demoRef = useRef<DemoMeter | null>(null);
  const statusRef = useRef<UnitsStatus>("safe");
  const lastAlertRef = useRef<Record<string, number>>({});
  const hydratedRef = useRef(false);
  const offRef = useRef<string[]>([]);

  // Restore which circuits the owner switched off.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(offKey) ?? "[]");
      if (Array.isArray(saved)) {
        offRef.current = saved.map(String);
        setOffCircuits(offRef.current);
      }
    } catch {
      /* ignore */
    }
  }, [offKey]);

  // Ticker for "last seen" and outage counters.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Hydrate today's kWh from the most recent saved reading.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("readings")
        .select("kwh_today")
        .eq("user_id", profile.id)
        .gte("created_at", startOfToday())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        kwhRef.current = Math.max(kwhRef.current, Number(data.kwh_today));
        setKwhToday(kwhRef.current);
      }
      hydratedRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [profile.id]);

  const pushAlert = useCallback((key: string, level: AlertItem["level"], message: string, cooldownMs = 60_000) => {
    const t = Date.now();
    if (t - (lastAlertRef.current[key] ?? 0) < cooldownMs) return;
    lastAlertRef.current[key] = t;
    setAlerts((a) => [{ id: `${key}-${t}`, t, level, message }, ...a].slice(0, 30));
    if (level === "critical") toast.error(message);
    else if (level === "warning") toast.warning(message);
  }, []);

  const handleTelemetry = useCallback(
    (m: Telemetry) => {
      const t = Date.now();
      latestRef.current = m;
      setLatest(m);
      setLastSeen(t);
      setSeries((s) => [...s, { t, kw: m.power_kw, v: m.voltage }].slice(-SERIES_MAX));

      // Energy: use the meter's cumulative counter so units match what the meter measured.
      const prev = lastEnergyRef.current;
      lastEnergyRef.current = m.energy_kwh;
      if (prev !== null) {
        const delta = m.energy_kwh - prev;
        if (delta > 0 && delta < 5) {
          kwhRef.current += delta;
          unitsRef.current = Math.max(0, unitsRef.current - delta);
          setKwhToday(kwhRef.current);
          setUnitsLeft(unitsRef.current);
        }
      }

      if (m.outage || m.voltage < 100) {
        setOutageStart((s) => s ?? t);
        pushAlert("outage", "critical", "Power outage detected — critical loads are at risk", 120_000);
      } else {
        setOutageStart((s) => {
          if (s !== null) pushAlert("restored", "info", "Power restored", 5_000);
          return null;
        });
      }

      if (m.alert) {
        const c = m.circuits.find((x) => x.id === m.alert);
        pushAlert(`spike-${m.alert}`, "warning", `Unusual draw on ${c?.name ?? m.alert} (${c ? Math.round(c.power_w) : "?"} W)`);
      }
    },
    [pushAlert],
  );

  const buildConfig = useCallback(
    (): MeterConfig => ({
      business: business.id,
      speed: 60,
      circuits: business.circuits.map((c) => ({
        id: c.id,
        name: c.name,
        w: c.ratedW,
        p: c.pattern,
        on: !offRef.current.includes(c.id),
      })),
    }),
    [business],
  );

  // Connect to the data source.
  useEffect(() => {
    lastEnergyRef.current = null;
    setLatest(null);
    setSeries([]);
    if (source === "demo") {
      setConnection("demo");
      const meter = new DemoMeter(business.circuits, device, 60, offRef.current);
      demoRef.current = meter;
      handleTelemetry(meter.tick(2));
      const id = setInterval(() => handleTelemetry(meter.tick(2)), 2000);
      return () => {
        clearInterval(id);
        demoRef.current = null;
      };
    }

    let disposed = false;
    setConnection("connecting");
    const topics = topicsFor(device);
    (async () => {
      const mod = await import("mqtt");
      const mqtt = (mod as unknown as { default?: typeof mod }).default ?? mod;
      if (disposed) return;
      const client = mqtt.connect(profile.mqtt_url, {
        clientId: `pp-web-${Math.random().toString(16).slice(2, 10)}`,
        clean: true,
        reconnectPeriod: 4000,
        connectTimeout: 10_000,
        keepalive: 30,
      });
      clientRef.current = client;
      client.on("connect", () => {
        setConnection("connected");
        client.subscribe([topics.telemetry, topics.status], { qos: 0 });
        client.publish(topics.config, JSON.stringify(buildConfig()), { retain: true, qos: 1 });
      });
      client.on("reconnect", () => setConnection("connecting"));
      client.on("error", () => setConnection("error"));
      client.on("offline", () => setConnection("error"));
      client.on("message", (topic, payload) => {
        const text = payload.toString();
        if (topic === topics.status) {
          setDeviceOnline(text.trim().toLowerCase() === "online");
          return;
        }
        const m = parseTelemetry(text);
        if (m) handleTelemetry(m);
      });
    })();
    return () => {
      disposed = true;
      clientRef.current?.end(true);
      clientRef.current = null;
    };
  }, [source, device, profile.mqtt_url, business, handleTelemetry, buildConfig]);

  // Save a reading and the units balance every 30 s.
  useEffect(() => {
    const id = setInterval(async () => {
      const m = latestRef.current;
      if (!m || !hydratedRef.current) return;
      if (Date.now() - (lastSeenRef.current ?? 0) > 15_000) return;
      await supabase.from("readings").insert({
        user_id: profile.id,
        total_kw: m.power_kw,
        voltage: m.voltage,
        kwh_today: Number(kwhRef.current.toFixed(4)),
        units_left: Number(unitsRef.current.toFixed(3)),
        circuits: m.circuits.map((c) => ({ id: c.id, name: c.name, w: c.power_w, a: c.current_a, on: c.on })),
        source,
      });
      await supabase
        .from("profiles")
        .update({ units_balance: Number(unitsRef.current.toFixed(3)) })
        .eq("id", profile.id);
    }, SAVE_EVERY_MS);
    return () => clearInterval(id);
  }, [profile.id, source]);

  const lastSeenRef = useRef<number | null>(null);
  lastSeenRef.current = lastSeen;

  const avgKw = useMemo(() => {
    const recent = series.slice(-30);
    if (!recent.length) return 0;
    return recent.reduce((s, p) => s + p.kw, 0) / recent.length;
  }, [series]);

  const status = unitsStatus(unitsLeft, avgKw);
  useEffect(() => {
    if (status !== statusRef.current) {
      if (status === "critical") pushAlert("units-critical", "critical", "Units critically low — top up now", 300_000);
      if (status === "warning") pushAlert("units-warning", "warning", "Units running low — plan a top-up", 300_000);
      statusRef.current = status;
    }
  }, [status, pushAlert]);

  const speed = latest?.speed ?? 60;
  const outage = useMemo(() => {
    if (outageStart === null) return null;
    const simHours = (((now - outageStart) / 1000) * speed) / 3600;
    const loss = estimateOutageLoss(simHours, business.loss, Number(profile.profit_per_hour), Number(profile.stock_value)).total;
    return { startedAt: outageStart, simHours, loss };
  }, [outageStart, now, speed, business, profile.profit_per_hour, profile.stock_value]);

  const sendCommand = useCallback(
    (cmd: MeterCommand) => {
      const c = clientRef.current;
      if (!c?.connected) return false;
      const topics = topicsFor(device);
      c.publish(topics.cmd, JSON.stringify(cmd), { qos: 1 });
      return true;
    },
    [device],
  );

  const toggleCircuit = useCallback(
    (id: string, on: boolean) => {
      const next = on ? offRef.current.filter((x) => x !== id) : Array.from(new Set([...offRef.current, id]));
      offRef.current = next;
      setOffCircuits(next);
      localStorage.setItem(offKey, JSON.stringify(next));
      if (source === "demo") {
        demoRef.current?.setOn(id, on);
        return;
      }
      if (!sendCommand({ id, on })) toast.error("Not connected to the meter yet");
      clientRef.current?.publish(topicsFor(device).config, JSON.stringify(buildConfig()), { retain: true, qos: 1 });
    },
    [source, sendCommand, offKey, device, buildConfig],
  );

  const simulateOutage = useCallback(
    (seconds: number) => {
      if (source === "demo") {
        demoRef.current?.triggerOutage(seconds);
        toast("Outage started", { description: `The demo meter will report no power for ${seconds} s.` });
        return;
      }
      if (sendCommand({ outage_s: seconds })) {
        toast("Outage command sent to the meter", { description: `No power for ${seconds} s.` });
      } else toast.error("Not connected to the meter yet");
    },
    [source, sendCommand],
  );

  const topUp = useCallback(
    async (units: number) => {
      unitsRef.current += units;
      setUnitsLeft(unitsRef.current);
      statusRef.current = unitsStatus(unitsRef.current, avgKw);
      await supabase
        .from("profiles")
        .update({ units_balance: Number(unitsRef.current.toFixed(3)) })
        .eq("id", profile.id);
    },
    [profile.id, avgKw],
  );

  const receiving = lastSeen !== null && now - lastSeen < 12_000;

  const value: TelemetryState = {
    source,
    connection,
    deviceOnline,
    lastSeen,
    receiving,
    latest,
    series,
    kwhToday,
    costToday: kwhToday * Number(profile.tariff_per_kwh),
    unitsLeft,
    avgKw,
    status,
    alerts,
    outage,
    speed,
    offCircuits,
    toggleCircuit,
    simulateOutage,
    topUp,
    clearAlerts: () => setAlerts([]),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
