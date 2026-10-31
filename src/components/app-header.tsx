import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  ChevronDown,
  CircuitBoard,
  History,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldAlert,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo, ThemeToggle } from "@/components/brand";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProfile } from "@/hooks/use-profile";
import { getBusiness } from "@/lib/business";
import { LiveStatusPill } from "@/components/live-status";

export const NAV = [
  { to: "/dashboard", label: "Dashboard", desc: "Live overview", icon: LayoutDashboard },
  { to: "/circuits", label: "Circuits", desc: "Every breaker, on/off", icon: CircuitBoard },
  { to: "/loss", label: "Loss Analysis", desc: "Outage cost in Kwacha", icon: ShieldAlert },
  { to: "/zedbot", label: "Ask ZedBot", desc: "AI energy assistant", icon: Bot },
  { to: "/history", label: "History", desc: "Saved readings & trends", icon: History },
  { to: "/settings", label: "Settings", desc: "Business, units, meter", icon: Settings },
] as const;

export function AppHeader() {
  const profile = useProfile();
  const business = getBusiness(profile.business_type);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const current = NAV.find((n) => pathname.startsWith(n.to)) ?? NAV[0];

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const initials = (profile.business_name || profile.full_name || "PP")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Logo to="/dashboard" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-2 h-10 gap-2 rounded-xl pl-3 pr-2.5">
              <current.icon className="text-primary" />
              <span className="hidden sm:inline">{current.label}</span>
              <ChevronDown className="text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72 rounded-2xl p-2">
            <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Go to</DropdownMenuLabel>
            {NAV.map((n) => {
              const active = pathname.startsWith(n.to);
              return (
                <DropdownMenuItem key={n.to} asChild className="cursor-pointer rounded-xl p-2.5">
                  <Link to={n.to} className="flex items-center gap-3">
                    <span
                      className={
                        active
                          ? "grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground"
                          : "grid size-9 place-items-center rounded-lg bg-primary-soft text-primary"
                      }
                    >
                      <n.icon className="size-4" />
                    </span>
                    <span className="flex flex-col">
                      <span className="font-medium">{n.label}</span>
                      <span className="text-xs text-muted-foreground">{n.desc}</span>
                    </span>
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="ml-auto flex items-center gap-1.5">
          <LiveStatusPill />
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="grid size-9 place-items-center rounded-full bg-gradient-sun font-display text-sm font-bold text-foreground shadow-soft"
                aria-label="Account menu"
              >
                {initials}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 rounded-2xl p-2">
              <div className="px-2 py-2">
                <p className="font-semibold">{profile.business_name || "Your business"}</p>
                <p className="text-xs text-muted-foreground">
                  {business.emoji} {business.label}
                </p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="cursor-pointer rounded-lg">
                <Link to="/settings">
                  <Settings /> Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={signOut} className="cursor-pointer rounded-lg text-danger focus:text-danger">
                <LogOut /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
