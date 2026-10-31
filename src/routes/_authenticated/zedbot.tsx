import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { z } from "zod";
import { ArrowUp, Bot, RotateCcw, Square, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useProfile } from "@/hooks/use-profile";
import { getBusiness } from "@/lib/business";
import { hoursOfUnitsLeft } from "@/lib/energy";
import { useTelemetry } from "@/lib/telemetry";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/zedbot")({
  validateSearch: (s) => z.object({ q: z.string().max(500).optional() }).parse(s),
  head: () => ({
    meta: [
      { title: "Ask ZedBot — PowerPulse" },
      { name: "description", content: "ZedBot is your AI energy assistant. Ask about consumption, costs, units and outages." },
      { property: "og:title", content: "Ask ZedBot — PowerPulse" },
      { property: "og:description", content: "AI answers about your business electricity, from your own readings." },
    ],
  }),
  component: ZedBot,
});

type Msg = { role: "user" | "model"; content: string };

const STARTERS = [
  "Give me a quick health check of my electricity today",
  "Which circuit is costing me the most, and how do I cut it?",
  "How long will my units last and when should I top up?",
  "What should I keep running during a 4-hour load-shedding?",
  "What size of solar and battery backup do I need?",
  "Am I on the right ZESCO tariff band this month?",
];

function ZedBot() {
  const { q } = Route.useSearch();
  const profile = useProfile();
  const business = getBusiness(profile.business_type);
  const t = useTelemetry();
  const storageKey = `pp-zedbot-${profile.id}`;
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const usedQ = useRef(false);
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
      if (Array.isArray(saved)) setMessages(saved.slice(-30));
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  useEffect(() => {
    if (!busy) localStorage.setItem(storageKey, JSON.stringify(messages.slice(-30)));
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy, storageKey]);

  useEffect(() => {
    if (q && !usedQ.current) {
      usedQ.current = true;
      // Give the meter a moment to deliver a first reading.
      const id = setTimeout(() => send(q), 600);
      return () => clearTimeout(id);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function snapshot() {
    const s = tRef.current;
    return {
      dataSource: s.source,
      receivingLiveData: s.receiving,
      lastReadingAgoSeconds: s.lastSeen ? Math.round((Date.now() - s.lastSeen) / 1000) : null,
      voltage: s.latest?.voltage ?? null,
      liveLoadKw: s.latest?.power_kw ?? null,
      avgLoadKwLastMinute: Number(s.avgKw.toFixed(3)),
      kwhToday: Number(s.kwhToday.toFixed(3)),
      costTodayK: Number(s.costToday.toFixed(2)),
      unitsLeftKwh: Number(s.unitsLeft.toFixed(2)),
      hoursOfUnitsLeft: Number.isFinite(hoursOfUnitsLeft(s.unitsLeft, s.avgKw))
        ? Number(hoursOfUnitsLeft(s.unitsLeft, s.avgKw).toFixed(1))
        : null,
      unitsStatus: s.status,
      outageInProgress: s.outage ? { hoursOff: Number(s.outage.simHours.toFixed(2)), lossSoFarK: Math.round(s.outage.loss) } : null,
      circuitsSwitchedOff: s.offCircuits,
      circuitsNow: (s.latest?.circuits ?? []).map((c) => ({ id: c.id, name: c.name, watts: Math.round(c.power_w), amps: c.current_a, on: c.on })),
      recentAlerts: s.alerts.slice(0, 8).map((a) => ({ level: a.level, message: a.message, minutesAgo: Math.round((Date.now() - a.t) / 60000) })),
      timeAcceleration: `${s.speed / 60} simulated minute(s) per real second`,
      localTime: new Date().toString(),
    };
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const history: Msg[] = [...messages, { role: "user", content }];
    setMessages([...history, { role: "model", content: "" }]);
    setInput("");
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch("/api/zedbot", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
        body: JSON.stringify({ messages: history.slice(-16), snapshot: snapshot() }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "ZedBot is unavailable right now." }));
        throw new Error(err.error ?? "ZedBot is unavailable right now.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => [...m.slice(0, -1), { role: "model", content: acc }]);
      }
      if (!acc.trim()) setMessages((m) => [...m.slice(0, -1), { role: "model", content: "_ZedBot returned no answer. Please ask again._" }]);
    } catch (e) {
      const aborted = e instanceof DOMException && e.name === "AbortError";
      setMessages((m) => {
        const last = m[m.length - 1];
        const note = aborted ? "\n\n_Stopped._" : `⚠️ ${(e as Error).message}`;
        return [...m.slice(0, -1), { role: "model", content: (last?.content ?? "") + (last?.content && !aborted ? "\n\n" : "") + note }];
      });
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-3xl flex-col">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-gradient-sun text-foreground shadow-soft">
            <Bot className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold">Ask ZedBot</h1>
            <p className="text-sm text-muted-foreground">
              Your energy assistant for {profile.business_name || business.label} · uses your live readings
            </p>
          </div>
        </div>
        {!empty && (
          <Button variant="ghost" size="sm" onClick={() => setMessages([])} disabled={busy}>
            <RotateCcw /> New chat
          </Button>
        )}
      </div>

      <div className="flex-1 space-y-5">
        {empty && (
          <div className="animate-rise rounded-3xl border border-border bg-gradient-card p-6 shadow-soft">
            <p className="font-display text-xl font-semibold">Mwashibukeni! What would you like to know?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              ZedBot sees your circuits, units, costs, alerts and saved history, plus ZESCO tariffs and load-shedding know-how.
            </p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-xl border border-border bg-card px-4 py-3 text-left text-sm transition-colors hover:border-primary/50 hover:bg-primary-soft"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
            <span
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-full",
                m.role === "user" ? "bg-primary text-primary-foreground" : "bg-gradient-sun text-foreground",
              )}
            >
              {m.role === "user" ? <User className="size-4" /> : <Bot className="size-4" />}
            </span>
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                m.role === "user" ? "rounded-tr-md bg-primary text-primary-foreground" : "rounded-tl-md border border-border bg-card shadow-soft",
              )}
            >
              {m.role === "model" && !m.content ? (
                <span className="flex gap-1 py-1">
                  {[0, 1, 2].map((d) => (
                    <span key={d} className="size-2 animate-bounce rounded-full bg-primary" style={{ animationDelay: `${d * 120}ms` }} />
                  ))}
                </span>
              ) : m.role === "model" ? (
                <div className="zb-md space-y-3 [&_a]:text-primary [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-xs [&_h1]:font-display [&_h1]:text-base [&_h1]:font-semibold [&_h2]:font-display [&_h2]:text-base [&_h2]:font-semibold [&_h3]:font-semibold [&_li]:ml-4 [&_ol]:list-decimal [&_ol]:space-y-1 [&_strong]:font-semibold [&_table]:w-full [&_table]:text-xs [&_td]:border-b [&_td]:border-border [&_td]:px-2 [&_td]:py-1.5 [&_th]:border-b [&_th]:border-border [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_ul]:list-disc [&_ul]:space-y-1">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{m.content}</p>
              )}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="sticky bottom-4 mt-6 flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-lift"
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, 2000))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder="Ask about your consumption, costs, units, outages…"
          className="min-h-11 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
          rows={1}
        />
        {busy ? (
          <Button type="button" size="icon" variant="outline" onClick={() => abortRef.current?.abort()} aria-label="Stop">
            <Square className="size-4" />
          </Button>
        ) : (
          <Button type="submit" size="icon" variant="hero" disabled={!input.trim()} aria-label="Send">
            <ArrowUp />
          </Button>
        )}
      </form>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        ZedBot gives guidance from your readings. Always use a qualified electrician for wiring work.
      </p>
    </div>
  );
}
