import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Building2, Loader2, MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Logo, ThemeToggle } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BusinessTypeSelect } from "@/components/business-type-select";
import { BUSINESS_TYPE_IDS } from "@/lib/business";
import heroImg from "@/assets/hero-board.jpg";

const searchSchema = z.object({ mode: z.enum(["signin", "signup"]).optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Sign in or register your business — PowerPulse" },
      { name: "description", content: "Business accounts for PowerPulse energy monitoring. Register with your business type." },
      { property: "og:title", content: "Sign in — PowerPulse" },
      { property: "og:description", content: "Register your business on PowerPulse and watch your electricity live." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your name").max(100),
  businessName: z.string().trim().min(2, "Enter your business name").max(120),
  businessType: z.enum(BUSINESS_TYPE_IDS, { errorMap: () => ({ message: "Choose your type of business" }) }),
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "Use at least 8 characters").max(72),
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"signin" | "signup" | "forgot">(mode === "signup" ? "signup" : "signin");
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [form, setForm] = useState({ fullName: "", businessName: "", businessType: "", email: "", password: "" });

  useEffect(() => setTab(mode === "signup" ? "signup" : "signin"), [mode]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) navigate({ to: "/dashboard", replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    const parsed = signupSchema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Check the form"); return; }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: window.location.origin + "/dashboard",
        data: {
          full_name: parsed.data.fullName,
          business_name: parsed.data.businessName,
          business_type: parsed.data.businessType,
        },
      },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    if (!data.session) setSentTo(parsed.data.email);
  }

  async function handleSignin(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email || !form.password) { toast.error("Enter your email and password"); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: form.email.trim(), password: form.password });
    setLoading(false);
    if (error) toast.error(error.message === "Email not confirmed" ? "Please confirm your email first" : error.message);
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    const email = z.string().trim().email().safeParse(form.email);
    if (!email.success) { toast.error("Enter a valid email"); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Check your email for a reset link");
    setTab("signin");
  }

  async function handleGoogle() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (result.error) {
      setLoading(false);
      toast.error("Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-6 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Logo />
          <ThemeToggle />
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          {sentTo ? (
            <div className="animate-rise text-center">
              <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary">
                <MailCheck className="size-7" />
              </span>
              <h1 className="mt-6 text-3xl font-bold">Confirm your email</h1>
              <p className="mt-3 text-muted-foreground">
                We sent a link to <b className="text-foreground">{sentTo}</b>. Open it to activate your business
                account.
              </p>
              <Button variant="outline" className="mt-8" onClick={() => { setSentTo(null); setTab("signin"); }}>
                Back to sign in
              </Button>
            </div>
          ) : (
            <div className="animate-rise">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-accent-foreground">
                <Building2 className="size-3.5" /> Business accounts only
              </span>
              <h1 className="mt-4 text-3xl font-bold">
                {tab === "signup" ? "Register your business" : tab === "forgot" ? "Reset your password" : "Welcome back"}
              </h1>
              <p className="mt-2 text-muted-foreground">
                {tab === "signup"
                  ? "We'll set up the right circuits for your type of business."
                  : tab === "forgot"
                    ? "We'll email you a link to choose a new password."
                    : "Sign in to see your board live."}
              </p>

              {tab !== "forgot" && (
                <>
                  <Button type="button" variant="outline" className="mt-8 h-11 w-full" onClick={handleGoogle} disabled={loading}>
                    <GoogleIcon /> Continue with Google
                  </Button>
                  <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="h-px flex-1 bg-border" /> or with email <span className="h-px flex-1 bg-border" />
                  </div>
                </>
              )}

              <form
                onSubmit={tab === "signup" ? handleSignup : tab === "forgot" ? handleForgot : handleSignin}
                className={tab === "forgot" ? "mt-8 space-y-4" : "space-y-4"}
              >
                {tab === "signup" && (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field id="fullName" label="Your name">
                        <Input id="fullName" className="h-11 bg-card" value={form.fullName} onChange={set("fullName")} maxLength={100} />
                      </Field>
                      <Field id="businessName" label="Business name">
                        <Input id="businessName" className="h-11 bg-card" value={form.businessName} onChange={set("businessName")} maxLength={120} />
                      </Field>
                    </div>
                    <Field id="businessType" label="Type of business">
                      <BusinessTypeSelect
                        id="businessType"
                        value={form.businessType}
                        onChange={(v) => setForm((f) => ({ ...f, businessType: v }))}
                      />
                    </Field>
                  </>
                )}
                <Field id="email" label="Work email">
                  <Input id="email" type="email" autoComplete="email" className="h-11 bg-card" value={form.email} onChange={set("email")} maxLength={255} />
                </Field>
                {tab !== "forgot" && (
                  <Field
                    id="password"
                    label="Password"
                    extra={
                      tab === "signin" ? (
                        <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setTab("forgot")}>
                          Forgot password?
                        </button>
                      ) : null
                    }
                  >
                    <Input
                      id="password"
                      type="password"
                      autoComplete={tab === "signup" ? "new-password" : "current-password"}
                      className="h-11 bg-card"
                      value={form.password}
                      onChange={set("password")}
                      maxLength={72}
                    />
                  </Field>
                )}
                <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="animate-spin" />}
                  {tab === "signup" ? "Create business account" : tab === "forgot" ? "Send reset link" : "Sign in"}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                {tab === "signup" ? (
                  <>
                    Already registered?{" "}
                    <Link to="/auth" className="font-semibold text-primary hover:underline">Sign in</Link>
                  </>
                ) : (
                  <>
                    New to PowerPulse?{" "}
                    <Link to="/auth" search={{ mode: "signup" }} className="font-semibold text-primary hover:underline">
                      Register your business
                    </Link>
                  </>
                )}
              </p>
            </div>
          )}
        </div>
      </div>
      <div className="relative hidden overflow-hidden lg:block">
        <img src={heroImg} alt="" className="absolute inset-0 size-full object-cover" width={1536} height={1152} />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 via-foreground/10 to-transparent" />
        <div className="absolute bottom-10 left-10 right-10 text-background">
          <p className="font-display text-3xl font-bold leading-tight">
            "The cold room tripped at 2 AM. PowerPulse told me before the meat spoiled."
          </p>
          <p className="mt-3 text-sm opacity-80">What we want every business owner to say.</p>
        </div>
      </div>
    </div>
  );
}

function Field({ id, label, extra, children }: { id: string; label: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        {extra}
      </div>
      {children}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.7 2.3 2.4 6.6 2.4 12s4.3 9.7 9.6 9.7c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z" />
    </svg>
  );
}
