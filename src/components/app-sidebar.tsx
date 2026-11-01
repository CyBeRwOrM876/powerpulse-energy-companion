import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart3, Bot, ChevronsUpDown, CircuitBoard, History, LayoutDashboard, LogOut, Settings, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProfile } from "@/hooks/use-profile";
import { getBusiness } from "@/lib/business";

type NavItem = {
  to: "/dashboard" | "/circuits" | "/analysis" | "/history" | "/zedbot" | "/settings";
  label: string;
  icon: typeof LayoutDashboard;
};

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Monitor",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/circuits", label: "Circuits", icon: CircuitBoard },
      { to: "/analysis", label: "Analysis", icon: BarChart3 },
      { to: "/history", label: "History", icon: History },
    ],
  },
  {
    label: "Assistant",
    items: [{ to: "/zedbot", label: "Ask ZedBot", icon: Bot }],
  },
  {
    label: "Business",
    items: [{ to: "/settings", label: "Settings", icon: Settings }],
  },
];

export const NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export function AppSidebar() {
  const { pathname } = useLocation();
  const { setOpenMobile } = useSidebar();
  const profile = useProfile();
  const business = getBusiness(profile.business_type);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-3">
        <Link to="/dashboard" className="flex items-center gap-2.5 overflow-hidden" onClick={() => setOpenMobile(false)}>
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow group-data-[collapsible=icon]:size-8">
            <Zap className="size-5" strokeWidth={2.5} />
          </span>
          <span className="font-display text-lg font-bold tracking-tight group-data-[collapsible=icon]:hidden">
            Power<span className="text-primary">Pulse</span>
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((g) => (
          <SidebarGroup key={g.label}>
            <SidebarGroupLabel>{g.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((n) => {
                  const active = pathname.startsWith(n.to);
                  return (
                    <SidebarMenuItem key={n.to}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={n.label}
                        className="h-10 rounded-xl data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:shadow-soft"
                      >
                        <Link to={n.to} onClick={() => setOpenMobile(false)}>
                          <n.icon />
                          <span>{n.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="rounded-xl" tooltip="Account">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-sun font-display text-xs font-bold text-foreground shadow-soft">
                    {initials}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col text-left leading-tight">
                    <span className="truncate text-sm font-semibold">{profile.business_name || "Your business"}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {business.emoji} {business.label}
                    </span>
                  </span>
                  <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-60 rounded-2xl p-2">
                <DropdownMenuItem asChild className="cursor-pointer rounded-lg">
                  <Link to="/settings" onClick={() => setOpenMobile(false)}>
                    <Settings /> Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="cursor-pointer rounded-lg text-danger focus:text-danger">
                  <LogOut /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
