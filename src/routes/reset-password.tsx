import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Choose a new password — PowerPulse" },
      { name: "description", content: "Set a new password for your PowerPulse business account." },
      { property: "og:title", content: "Reset password — PowerPulse" },
      { property: "og:description", content: "Set a new password for your PowerPulse business account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { toast.error("Use at least 8 characters"); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password updated");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-hero px-5">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-8 shadow-lift">
        <Logo />
        <h1 className="mt-6 text-2xl font-bold">Choose a new password</h1>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pw">New password</Label>
            <Input id="pw" type="password" className="h-11" value={password} onChange={(e) => setPassword(e.target.value)} maxLength={72} />
          </div>
          <Button type="submit" variant="hero" className="w-full" disabled={loading}>
            Save password
          </Button>
        </form>
      </div>
    </div>
  );
}
