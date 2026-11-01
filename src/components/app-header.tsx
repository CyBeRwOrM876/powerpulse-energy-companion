import { useLocation } from "@tanstack/react-router";
import { ThemeToggle } from "@/components/brand";
import { LiveStatusPill } from "@/components/live-status";
import { NAV } from "@/components/app-sidebar";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function AppHeader() {
  const { pathname } = useLocation();
  const current = NAV.find((n) => pathname.startsWith(n.to)) ?? NAV[0];

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
        <SidebarTrigger className="-ml-1 size-9 rounded-lg" aria-label="Show or hide the menu" />
        <span className="h-5 w-px bg-border" />
        <span className="flex items-center gap-2 font-medium">
          <current.icon className="size-4 text-primary" />
          {current.label}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <LiveStatusPill />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
