import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { profileQuery, useProfile, useUpdateProfile } from "@/hooks/use-profile";
import { TelemetryProvider } from "@/lib/telemetry";
import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { OutageBanner } from "@/components/dashboard-bits";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { BusinessTypeSelect } from "@/components/business-type-select";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(profileQuery),
  pendingComponent: () => (
    <div className="grid min-h-screen place-items-center">
      <div className="size-10 animate-spin rounded-full border-4 border-primary-soft border-t-primary" />
    </div>
  ),
  component: AuthedLayout,
});

function AuthedLayout() {
  const profile = useProfile();
  return (
    <TelemetryProvider profile={profile}>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="min-w-0">
          <AppHeader />
          <OutageBanner />
          <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
      <Onboarding />
    </TelemetryProvider>
  );
}

/** Google sign-ups arrive without business details — collect them once. */
function Onboarding() {
  const profile = useProfile();
  const update = useUpdateProfile();
  const [name, setName] = useState(profile.business_name);
  const [type, setType] = useState(profile.business_type);
  const open = !profile.business_name;

  async function save() {
    if (name.trim().length < 2) { toast.error("Enter your business name"); return; }
    await update.mutateAsync({ business_name: name.trim().slice(0, 120), business_type: type });
    toast.success("Business saved");
  }

  return (
    <Dialog open={open}>
      <DialogContent className="rounded-3xl [&>button]:hidden">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Tell us about your business</DialogTitle>
          <DialogDescription>PowerPulse is for businesses. We'll set up your circuits from your business type.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ob-name">Business name</Label>
            <Input id="ob-name" className="h-11" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ob-type">Type of business</Label>
            <BusinessTypeSelect id="ob-type" value={type} onChange={setType} />
          </div>
          <Button variant="hero" className="w-full" onClick={save} disabled={update.isPending}>
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
