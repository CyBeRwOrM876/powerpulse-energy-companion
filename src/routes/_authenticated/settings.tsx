import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Building2, Copy, Download, Radio, Wallet } from "lucide-react";
import { PageHeader, Panel } from "@/components/dashboard-bits";
import { BusinessTypeSelect } from "@/components/business-type-select";
import { TopUpButton } from "@/components/top-up";
import { useLiveLabel } from "@/components/live-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useProfile, useUpdateProfile } from "@/hooks/use-profile";
import { useTelemetry } from "@/lib/telemetry";
import { DEFAULT_BROKER_HOST, DEFAULT_BROKER_WSS, topicsFor } from "@/lib/telemetry-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — PowerPulse" },
      { name: "description", content: "Business details, tariff, prepaid units and live meter connection." },
      { property: "og:title", content: "Settings — PowerPulse" },
      { property: "og:description", content: "Manage your PowerPulse business settings." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const profile = useProfile();
  const update = useUpdateProfile();
  const t = useTelemetry();
  const live = useLiveLabel();
  const [form, setForm] = useState({
    full_name: profile.full_name,
    business_name: profile.business_name,
    business_type: profile.business_type,
    tariff_per_kwh: String(profile.tariff_per_kwh),
    profit_per_hour: String(profile.profit_per_hour),
    stock_value: String(profile.stock_value),
  });
  const [conn, setConn] = useState({ device_id: profile.device_id, mqtt_url: profile.mqtt_url });

  useEffect(() => setConn({ device_id: profile.device_id, mqtt_url: profile.mqtt_url }), [profile.device_id, profile.mqtt_url]);

  const topics = topicsFor(profile.device_id);

  async function saveBusiness(e: React.FormEvent) {
    e.preventDefault();
    const tariff = Number(form.tariff_per_kwh);
    const profit = Number(form.profit_per_hour);
    const stock = Number(form.stock_value);
    if (form.business_name.trim().length < 2) return toast.error("Enter your business name");
    if (!(tariff > 0 && tariff < 50)) return toast.error("Tariff should be between K0 and K50 per kWh");
    if (!(profit >= 0 && profit < 1e7) || !(stock >= 0 && stock < 1e9)) return toast.error("Check profit and stock values");
    await update.mutateAsync({
      full_name: form.full_name.trim().slice(0, 100),
      business_name: form.business_name.trim().slice(0, 120),
      business_type: form.business_type,
      tariff_per_kwh: tariff,
      profit_per_hour: profit,
      stock_value: stock,
    });
    toast.success("Business details saved");
  }

  async function saveConnection(e: React.FormEvent) {
    e.preventDefault();
    const id = conn.device_id.trim();
    if (!/^[A-Za-z0-9_-]{3,40}$/.test(id)) return toast.error("Device ID: 3–40 letters, numbers, - or _");
    if (!/^wss?:\/\/[^\s]+$/.test(conn.mqtt_url.trim())) return toast.error("Broker address must start with wss://");
    await update.mutateAsync({ device_id: id, mqtt_url: conn.mqtt_url.trim().slice(0, 200) });
    toast.success("Connection saved — reconnecting");
  }

  const copy = (v: string) => {
    navigator.clipboard.writeText(v);
    toast.success("Copied");
  };

  return (
    <>
      <PageHeader title="Settings" subtitle="Your business, money values and where the live readings come from" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Building2 className="size-4 text-primary" /> Business
          </h2>
          <form onSubmit={saveBusiness} className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Your name" id="s-name">
                <Input id="s-name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} maxLength={100} />
              </Field>
              <Field label="Business name" id="s-bname">
                <Input id="s-bname" value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} maxLength={120} />
              </Field>
            </div>
            <Field label="Type of business" id="s-type">
              <BusinessTypeSelect id="s-type" value={form.business_type} onChange={(v) => setForm({ ...form, business_type: v })} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Tariff (K per kWh)" id="s-tariff">
                <Input id="s-tariff" type="number" step="0.01" className="font-mono" value={form.tariff_per_kwh} onChange={(e) => setForm({ ...form, tariff_per_kwh: e.target.value })} />
              </Field>
              <Field label="Profit per hour (K)" id="s-profit">
                <Input id="s-profit" type="number" className="font-mono" value={form.profit_per_hour} onChange={(e) => setForm({ ...form, profit_per_hour: e.target.value })} />
              </Field>
              <Field label="Stock value (K)" id="s-stock">
                <Input id="s-stock" type="number" className="font-mono" value={form.stock_value} onChange={(e) => setForm({ ...form, stock_value: e.target.value })} />
              </Field>
            </div>
            <p className="text-xs text-muted-foreground">
              ZESCO commercial bands 2026/27: C1 K0.92 · C2 K1.58 · C3 K2.63 · C4 K3.16 per kWh. Use the band you usually reach.
            </p>
            <Button type="submit" variant="hero" disabled={update.isPending}>
              Save business
            </Button>
          </form>
        </Panel>

        <div className="space-y-6">
          <Panel>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Wallet className="size-4 text-primary" /> Prepaid units
            </h2>
            <div className="mt-4 flex items-center justify-between gap-4">
              <div>
                <p className="font-mono text-3xl font-semibold tabular">{t.unitsLeft.toFixed(1)} <span className="text-base text-muted-foreground">kWh</span></p>
                <p className="text-xs text-muted-foreground">Goes down as the meter reports energy used</p>
              </div>
              <TopUpButton />
            </div>
          </Panel>

          <Panel>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Radio className="size-4 text-primary" /> Live readings
            </h2>
            <RadioGroup
              value={profile.data_source}
              onValueChange={(v) => update.mutate({ data_source: v as "mqtt" | "demo" })}
              className="mt-4 grid gap-3 sm:grid-cols-2"
            >
              {[
                { v: "mqtt", title: "Physical meter", body: "Readings from your board over MQTT" },
                { v: "demo", title: "Demo data", body: "Simulated in this browser" },
              ].map((o) => (
                <Label
                  key={o.v}
                  htmlFor={`src-${o.v}`}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card p-4",
                    profile.data_source === o.v && "border-primary bg-primary-soft",
                  )}
                >
                  <RadioGroupItem id={`src-${o.v}`} value={o.v} className="mt-0.5" />
                  <span>
                    <span className="block font-semibold">{o.title}</span>
                    <span className="block text-xs font-normal text-muted-foreground">{o.body}</span>
                  </span>
                </Label>
              ))}
            </RadioGroup>
            <p className="mt-3 text-sm">
              Status: <b>{live.label}</b>
            </p>
          </Panel>
        </div>

        <Panel className="lg:col-span-2">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <h2 className="text-lg font-semibold">Meter connection</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Your meter publishes to an MQTT broker. Use the same details in MQTT Explorer to watch the messages.
              </p>
            </div>
            <Button asChild variant="outline">
              <a href="/firmware/powerpulse_meter.ino" download>
                <Download /> Meter code (.ino)
              </a>
            </Button>
          </div>

          <form onSubmit={saveConnection} className="mt-5 grid gap-4 md:grid-cols-[1fr_1.4fr_auto] md:items-end">
            <Field label="Device ID" id="c-dev">
              <Input id="c-dev" className="font-mono" value={conn.device_id} onChange={(e) => setConn({ ...conn, device_id: e.target.value })} maxLength={40} />
            </Field>
            <Field label="Broker for this website (WebSocket)" id="c-url">
              <Input id="c-url" className="font-mono" value={conn.mqtt_url} onChange={(e) => setConn({ ...conn, mqtt_url: e.target.value })} maxLength={200} />
            </Field>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setConn({ ...conn, mqtt_url: DEFAULT_BROKER_WSS })}>
                Reset
              </Button>
              <Button type="submit" variant="hero" disabled={update.isPending}>
                Save
              </Button>
            </div>
          </form>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl bg-muted/60 p-4">
              <p className="text-sm font-semibold">MQTT Explorer / meter settings</p>
              <dl className="mt-3 space-y-2 text-sm">
                <Row k="Host" v={DEFAULT_BROKER_HOST} onCopy={copy} />
                <Row k="Port" v="1883 (no TLS)" onCopy={() => copy("1883")} />
                <Row k="Username / password" v="leave empty" />
                <Row k="Subscribe to" v={`${topics.base}/#`} onCopy={copy} />
              </dl>
            </div>
            <div className="rounded-xl bg-muted/60 p-4">
              <p className="text-sm font-semibold">Topics</p>
              <dl className="mt-3 space-y-2 text-sm">
                <Row k="Readings (meter → site)" v={topics.telemetry} onCopy={copy} />
                <Row k="Online status" v={topics.status} onCopy={copy} />
                <Row k="Circuit setup (site → meter)" v={topics.config} onCopy={copy} />
                <Row k="Switch / outage commands" v={topics.cmd} onCopy={copy} />
              </dl>
            </div>
          </div>
          <ol className="mt-5 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Open the meter code in Arduino IDE, install PubSubClient and ArduinoJson, set your Wi-Fi name, password and Device ID <b className="font-mono text-foreground">{profile.device_id}</b>.</li>
            <li>Upload to the board. Choose “Physical meter” above — the status turns to <b className="text-foreground">Live</b> within seconds.</li>
            <li>In MQTT Explorer connect to {DEFAULT_BROKER_HOST}:1883 and open <span className="font-mono">{topics.base}</span> to see every message.</li>
          </ol>
        </Panel>
      </div>
    </>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function Row({ k, v, onCopy }: { k: string; v: string; onCopy?: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="flex items-center gap-1.5 font-mono text-xs">
        <span className="truncate">{v}</span>
        {onCopy && (
          <button type="button" onClick={() => onCopy(v)} className="rounded p-1 text-muted-foreground hover:bg-card hover:text-foreground" aria-label={`Copy ${k}`}>
            <Copy className="size-3.5" />
          </button>
        )}
      </dd>
    </div>
  );
}
