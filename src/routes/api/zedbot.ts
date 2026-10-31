import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { getBusiness, PRIORITY_LABEL } from "@/lib/business";
import { estimateOutageLoss, zescoCommercialMonthlyCost } from "@/lib/energy";
import { knowledgeAsText } from "@/lib/zedbot-knowledge";

const MODELS = ["gemini-3-flash-preview", "gemini-3.1-flash-lite"];

const bodySchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "model"]), content: z.string().max(8000) }))
    .min(1)
    .max(20),
  snapshot: z.record(z.unknown()).optional(),
});

function json(status: number, error: string) {
  return new Response(JSON.stringify({ error }), { status, headers: { "Content-Type": "application/json" } });
}

type ReadingRow = { created_at: string; total_kw: number; kwh_today: number; units_left: number; circuits: unknown };

function liveSummary(snap: Record<string, unknown> | undefined): string {
  if (!snap) return "No live snapshot was sent.";
  const live = snap["receivingLiveData"] === true;
  const circuits = Array.isArray(snap["circuitsNow"]) ? (snap["circuitsNow"] as { name: string; watts: number; amps: number; on: boolean }[]) : [];
  const lines = [
    live
      ? `LIVE DATA IS FLOWING (source: ${snap["dataSource"] === "demo" ? "demo meter" : "physical meter"}). Treat the numbers below as the real, current state of the board.`
      : "Live readings are NOT arriving right now; use the last known values and say so briefly.",
    `Live load ${snap["liveLoadKw"] ?? "?"} kW (1-minute average ${snap["avgLoadKwLastMinute"] ?? "?"} kW) at ${snap["voltage"] ?? "?"} V.`,
    `Used today ${snap["kwhToday"] ?? "?"} kWh costing K${snap["costTodayK"] ?? "?"}. Units left ${snap["unitsLeftKwh"] ?? "?"} kWh ≈ ${snap["hoursOfUnitsLeft"] ?? "?"} h at the current average (status ${snap["unitsStatus"] ?? "?"}).`,
    circuits.length
      ? "Circuits right now: " + circuits.map((c) => `${c.name} ${c.on ? `${c.watts} W / ${c.amps} A` : "SWITCHED OFF"}`).join("; ") + "."
      : "No per-circuit readings yet.",
  ];
  if (snap["outageInProgress"]) lines.push(`OUTAGE IN PROGRESS: ${JSON.stringify(snap["outageInProgress"])}.`);
  return lines.join("\n");
}

function summarise(rows: ReadingRow[]) {
  const first = rows[0];
  const last = rows[rows.length - 1];
  if (!first || !last) return "No saved readings yet in the last 7 days.";
  const tz = "Africa/Lusaka";
  const hourFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: tz });
  const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz });
  const byHour = new Map<string, number[]>();
  const byDay = new Map<string, number>();
  const circuitW = new Map<string, { name: string; sum: number; n: number }>();
  let peak: ReadingRow = first;
  for (const r of rows) {
    const d = new Date(r.created_at);
    const h = hourFmt.format(d);
    byHour.set(h, [...(byHour.get(h) ?? []), Number(r.total_kw)]);
    const day = dayFmt.format(d);
    byDay.set(day, Math.max(byDay.get(day) ?? 0, Number(r.kwh_today)));
    if (Number(r.total_kw) > Number(peak.total_kw)) peak = r;
    if (Array.isArray(r.circuits)) {
      for (const c of r.circuits as { id: string; name: string; w: number }[]) {
        const e = circuitW.get(c.id) ?? { name: c.name, sum: 0, n: 0 };
        e.sum += Number(c.w) || 0;
        e.n += 1;
        circuitW.set(c.id, e);
      }
    }
  }
  const avg = rows.reduce((s, r) => s + Number(r.total_kw), 0) / rows.length;
  const hourly = [...byHour.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([h, v]) => `${h}:00 ${(v.reduce((s, x) => s + x, 0) / v.length).toFixed(2)} kW`)
    .join(", ");
  const totalCircuit = [...circuitW.values()].reduce((s, c) => s + c.sum / c.n, 0) || 1;
  const circuits = [...circuitW.values()]
    .map((c) => ({ name: c.name, avg: c.sum / c.n }))
    .sort((a, b) => b.avg - a.avg)
    .map((c) => `${c.name} avg ${Math.round(c.avg)} W (${Math.round((c.avg / totalCircuit) * 100)}%)`)
    .join("; ");
  const days = [...byDay.entries()].sort().map(([d, k]) => `${d}: ${k.toFixed(1)} kWh`).join("; ");
  return [
    `Saved readings: ${rows.length} (every ~30 s while the dashboard is open), from ${first.created_at} to ${last.created_at}.`,
    `Average load ${avg.toFixed(2)} kW; peak ${Number(peak.total_kw).toFixed(2)} kW at ${new Date(peak.created_at).toLocaleString("en-GB", { timeZone: tz })}.`,
    `Average load by hour of day (Lusaka time): ${hourly}.`,
    `Average share by circuit: ${circuits}.`,
    `Energy used per day (kWh_today max): ${days}.`,
    `Units went from ${Number(first.units_left).toFixed(1)} to ${Number(last.units_left).toFixed(1)} kWh over this period.`,
  ].join("\n");
}

export const Route = createFileRoute("/api/zedbot")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["GEMINI_API_KEY"];
        const SUPABASE_URL = process.env["SUPABASE_URL"];
        const SUPABASE_KEY = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!apiKey) return json(500, "ZedBot is not configured: the Gemini key is missing.");
        if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, "Server is missing configuration.");

        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (token.split(".").length !== 3) return json(401, "Please sign in again.");

        const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
          global: {
            headers: { Authorization: `Bearer ${token}` },
            fetch: (input, init) => {
              const h = new Headers(init?.headers);
              h.set("apikey", SUPABASE_KEY);
              return fetch(input, { ...init, headers: h });
            },
          },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });
        const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
        const userId = claims?.claims?.sub;
        if (claimsErr || !userId) return json(401, "Please sign in again.");

        let body: z.infer<typeof bodySchema>;
        try {
          body = bodySchema.parse(await request.json());
        } catch {
          return json(400, "Invalid question.");
        }

        const [{ data: profile }, { data: readings }] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
          supabase
            .from("readings")
            .select("created_at,total_kw,kwh_today,units_left,circuits")
            .eq("user_id", userId)
            .gte("created_at", new Date(Date.now() - 7 * 864e5).toISOString())
            .order("created_at", { ascending: true })
            .limit(1000),
        ]);
        if (!profile) return json(404, "Business profile not found.");

        const business = getBusiness(profile.business_type);
        const profit = Number(profile.profit_per_hour);
        const stock = Number(profile.stock_value);
        const lossTable = [1, 2, 4, 8]
          .map((h) => {
            const l = estimateOutageLoss(h, business.loss, profit, stock);
            return `${h} h: K${Math.round(l.total)} (profit K${Math.round(l.lostProfit)}, stock K${Math.round(l.spoilage)})`;
          })
          .join("; ");

        const system = `You are **ZedBot**, the AI energy assistant inside PowerPulse (by ZedWatts), built for Zambian businesses.
You help the owner of ONE specific business understand and act on its electricity, using its live meter readings and saved history below.

# How to answer
- Be practical, warm and direct, like a smart energy manager who knows Zambia. Plain English; a short Bemba/Nyanja greeting is fine occasionally.
- Ground every claim in the numbers provided. Quote real figures (kW, kWh, units, Kwacha "K") and show quick working for calculations (e.g. "2.1 kW × 6 h = 12.6 kWh ≈ K33").
- Lead with the answer in 1–2 sentences, then up to 3–5 bullet points of specific actions ranked by money saved or risk reduced. Use a small table only when comparing options.
- Keep answers under ~220 words unless the user asks for detail.
- If data is missing (no live readings, few saved readings), say so briefly and answer from the business profile, circuit ratings and reference data, labelled as estimates.
- Money is in Zambian Kwacha. Use the business's own tariff for daily costs; mention ZESCO bands when the monthly total matters.
- Readings come from a meter whose clock is time-accelerated (see timeAcceleration) for demos; treat kWh and units as the business's real consumption, and live kW as the real current load.
- Scope: consumption, costs, prepaid units, outages/load-shedding, outage loss, which circuits to shed, efficiency, backup/solar sizing, tariffs, safe practices.
- You do NOT predict equipment failure and must never claim to. You may point out an unusual draw on a circuit and suggest a check by a qualified technician.
- Never give instructions for live electrical work; recommend a qualified electrician for wiring, changeover switches or board changes.
- If asked something unrelated to electricity or the business, answer briefly and steer back.

# The business
- Name: ${profile.business_name || "(not set)"}; owner: ${profile.full_name || "(not set)"}
- Type: ${business.label} — ${business.blurb}
- Tariff used for costs: K${Number(profile.tariff_per_kwh).toFixed(2)} per kWh
- Profit per trading hour: K${profit}; perishable stock value: K${stock}
- Prepaid units balance on record: ${Number(profile.units_balance).toFixed(1)} kWh
- Data source: ${profile.data_source === "demo" ? "demo meter in the browser" : `live meter over MQTT (device ${profile.device_id})`}
- Circuits (id, name, rated W, priority): ${business.circuits.map((c) => `${c.id} ${c.name} ${c.ratedW} W ${PRIORITY_LABEL[c.priority]}`).join("; ")}
- Outage loss model for this business: ${lossTable}. Revenue dependency ${Math.round(business.loss.revenueDependency * 100)}%; ${
          business.loss.spoilageStartHours === null
            ? "no perishable stock"
            : `stock starts spoiling after ${business.loss.spoilageStartHours} h at ${Math.round(business.loss.spoilageRatePerHour * 100)}%/h (max ${Math.round(business.loss.maxSpoilage * 100)}%)`
        }.
- Example monthly bill on the ZESCO commercial bands: 300 kWh ≈ K${Math.round(zescoCommercialMonthlyCost(300))}, 600 kWh ≈ K${Math.round(zescoCommercialMonthlyCost(600))}, 1000 kWh ≈ K${Math.round(zescoCommercialMonthlyCost(1000))}.

# Live snapshot from the dashboard
${liveSummary(body.snapshot)}
Full snapshot JSON: ${JSON.stringify(body.snapshot ?? {}, null, 0).slice(0, 6000)}

# Saved history (last 7 days)
${summarise((readings ?? []) as ReadingRow[])}

# Reference dataset
${knowledgeAsText()}`;

        const payload = {
          systemInstruction: { parts: [{ text: system }] },
          contents: body.messages.map((m) => ({ role: m.role, parts: [{ text: m.content }] })),
          generationConfig: { maxOutputTokens: 4096 },
        };

        let upstream: Response | null = null;
        let lastStatus = 500;
        for (const model of MODELS) {
          upstream = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
              body: JSON.stringify(payload),
              signal: request.signal,
            },
          );
          if (upstream.ok && upstream.body) break;
          lastStatus = upstream.status;
          const retryable = upstream.status === 404 || upstream.status === 429 || upstream.status >= 500;
          await upstream.body?.cancel();
          upstream = null;
          if (!retryable) break;
        }

        if (!upstream?.body) {
          if (lastStatus === 429) return json(429, "ZedBot is busy (Gemini rate limit reached). Try again in a minute.");
          if (lastStatus === 400 || lastStatus === 403) return json(lastStatus, "The Gemini key was rejected. Check the key in project settings.");
          return json(502, "ZedBot could not reach Gemini right now. Please try again.");
        }

        const reader = upstream.body.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let buffer = "";
        const stream = new ReadableStream<Uint8Array>({
          async pull(controller) {
            const { value, done } = await reader.read();
            if (done) {
              controller.close();
              return;
            }
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data:")) continue;
              try {
                const evt = JSON.parse(trimmed.slice(5));
                const parts = evt?.candidates?.[0]?.content?.parts ?? [];
                const text = parts
                  .filter((p: { thought?: boolean }) => !p.thought)
                  .map((p: { text?: string }) => p.text ?? "")
                  .join("");
                if (text) controller.enqueue(encoder.encode(text));
              } catch {
                /* partial line */
              }
            }
          },
          cancel() {
            reader.cancel();
          },
        });

        return new Response(stream, {
          headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
