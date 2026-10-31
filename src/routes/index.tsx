import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  Bot,
  Gauge,
  PlugZap,
  Radio,
  ShieldAlert,
  Sparkles,
  Zap,
} from "lucide-react";
import heroImg from "@/assets/hero-board.jpg";
import { Logo, ThemeToggle } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { BUSINESS_LIST } from "@/lib/business";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PowerPulse — Know where your business electricity goes" },
      {
        name: "description",
        content:
          "PowerPulse turns your distribution board into a live dashboard with outage-loss estimates, prepaid unit alerts and ZedBot, your AI energy assistant.",
      },
      { property: "og:title", content: "PowerPulse — Energy intelligence for Zambian businesses" },
      {
        property: "og:description",
        content: "Live circuit monitoring, units-left warnings, outage loss in Kwacha and an AI assistant called ZedBot.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: Activity, title: "Circuit-level monitoring", body: "See every breaker's live draw — fridges, ovens, pumps, lights." },
  { icon: Gauge, title: "Units & cost in Kwacha", body: "Prepaid units left, hours remaining and today's cost on your ZESCO tariff." },
  { icon: ShieldAlert, title: "Outage loss estimate", body: "Know what every hour without power costs your type of business." },
  { icon: Bot, title: "Ask ZedBot", body: "Your AI energy assistant answers questions using your own readings." },
];

const STEPS = [
  { icon: PlugZap, title: "Clamp sensors", body: "Non-invasive current clamps go on the breakers you care about." },
  { icon: Radio, title: "Smart meter unit", body: "Reads every circuit and publishes live readings over MQTT." },
  { icon: Sparkles, title: "Dashboard + ZedBot", body: "Trends, alerts, costs and plain-language advice in real time." },
];

function Landing() {
  const session = useSession();
  const signedIn = Boolean(session);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Logo />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {signedIn ? (
              <Button asChild variant="hero">
                <Link to="/dashboard">Open dashboard</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" className="hidden sm:inline-flex">
                  <Link to="/auth">Sign in</Link>
                </Button>
                <Button asChild variant="hero">
                  <Link to="/auth" search={{ mode: "signup" }}>
                    Get started
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-hero">
        <div className="absolute inset-0 bg-grid [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 md:py-24 lg:grid-cols-[1.05fr_1fr]">
          <div className="animate-rise">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary-soft px-3 py-1 text-xs font-semibold text-accent-foreground">
              <span className="size-1.5 rounded-full bg-primary pulse-dot text-primary" />
              For Zambian businesses · by ZedWatts
            </span>
            <h1 className="mt-6 text-5xl font-bold leading-[1.02] md:text-6xl">
              Know where your <span className="text-gradient-primary">electricity</span> goes.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              PowerPulse turns your distribution board into a live dashboard — so you cut waste, plan around
              load-shedding and protect your stock and profit.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="hero" size="lg">
                <Link to={signedIn ? "/dashboard" : "/auth"} search={signedIn ? {} : { mode: "signup" }}>
                  <Zap /> {signedIn ? "Open dashboard" : "Register your business"}
                </Link>
              </Button>
              {!signedIn && (
                <Button asChild variant="outline" size="lg">
                  <Link to="/auth">Sign in</Link>
                </Button>
              )}
            </div>
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-6">
              {[
                ["2 s", "live updates"],
                ["11", "business types"],
                ["K", "loss in Kwacha"],
              ].map(([v, l]) => (
                <div key={l}>
                  <dt className="font-display text-2xl font-bold">{v}</dt>
                  <dd className="text-xs text-muted-foreground">{l}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative animate-rise [animation-delay:120ms]">
            <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-lift">
              <img
                src={heroImg}
                alt="Business distribution board fitted with PowerPulse current sensors"
                width={1536}
                height={1152}
                className="aspect-[4/3] w-full object-cover"
              />
            </div>
            <div className="absolute -bottom-6 -left-4 animate-float rounded-2xl border border-border bg-card/95 p-4 shadow-lift backdrop-blur md:-left-8">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <span className="size-1.5 rounded-full bg-success pulse-dot text-success" /> Live load
              </p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular">
                4.82 <span className="text-sm text-muted-foreground">kW</span>
              </p>
            </div>
            <div className="absolute -right-3 -top-5 hidden animate-float rounded-2xl border border-border bg-card/95 p-4 shadow-lift backdrop-blur [animation-delay:1.5s] sm:block">
              <p className="text-xs font-medium text-muted-foreground">Units left</p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular text-primary">212.4</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-border bg-gradient-card p-6 shadow-soft transition-all hover:-translate-y-1 hover:shadow-lift"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <f.icon className="size-5" />
              </span>
              <h3 className="mt-5 font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-muted/50">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 lg:grid-cols-2">
          <div>
            <span className="text-sm font-semibold text-primary">Meet ZedBot</span>
            <h2 className="mt-2 text-4xl font-bold">An energy manager that reads your board.</h2>
            <p className="mt-4 text-muted-foreground">
              Ask anything about your electricity — which circuit costs the most, how long your units will last, what
              to switch off during load-shedding, or what size of solar backup fits your real usage.
            </p>
            <Button asChild variant="hero" size="lg" className="mt-8">
              <Link to={signedIn ? "/zedbot" : "/auth"}>
                Ask ZedBot <ArrowRight />
              </Link>
            </Button>
          </div>
          <div className="space-y-3 rounded-3xl border border-border bg-card p-5 shadow-lift">
            <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm text-primary-foreground">
              Why are my units finishing so fast this week?
            </div>
            <div className="flex gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-sun text-foreground">
                <Bot className="size-4" />
              </span>
              <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-muted px-4 py-3 text-sm">
                Your <b>cold room</b> is drawing 2.1 kW for 70% of the time — up from 55% last week. That's about{" "}
                <b>K38 a day</b> extra. Check the door seal and keep the door closed during deliveries. At today's
                rate your 180 units last about <b>31 hours</b>.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="text-4xl font-bold">Built for businesses, not homes.</h2>
        <p className="mt-3 text-muted-foreground">
          Pick your business type and PowerPulse sets up the right circuits automatically.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          {BUSINESS_LIST.map((b) => (
            <span
              key={b.id}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium shadow-soft transition-colors hover:border-primary/50 hover:bg-primary-soft"
            >
              <span>{b.emoji}</span> {b.label}
            </span>
          ))}
        </div>

        <div className="mt-20 grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="relative rounded-2xl border border-border bg-card p-6 shadow-soft">
              <span className="absolute right-5 top-5 font-mono text-5xl font-bold text-primary/15">{i + 1}</span>
              <s.icon className="size-6 text-primary" />
              <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-primary p-10 text-primary-foreground shadow-glow md:p-14">
          <div className="absolute inset-0 bg-grid opacity-40" />
          <div className="relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div>
              <h2 className="text-3xl font-bold md:text-4xl">Stop finding out when it's too late.</h2>
              <p className="mt-2 opacity-90">Register your business and watch your board live in minutes.</p>
            </div>
            <Button asChild size="lg" variant="secondary">
              <Link to={signedIn ? "/dashboard" : "/auth"} search={signedIn ? {} : { mode: "signup" }}>
                {signedIn ? "Open dashboard" : "Get started free"} <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-5 py-8 text-sm text-muted-foreground md:flex-row md:items-center">
          <Logo />
          <p>PowerPulse supports decision-making; it does not guarantee savings or confirm faults automatically.</p>
        </div>
      </footer>
    </div>
  );
}
