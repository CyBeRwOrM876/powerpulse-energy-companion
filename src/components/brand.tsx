import { Link } from "@tanstack/react-router";
import { Moon, Sun, Zap } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";

export function Logo({ to = "/" }: { to?: "/" | "/dashboard" }) {
  return (
    <Link to={to} className="group flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow transition-transform group-hover:rotate-6">
        <Zap className="size-5" strokeWidth={2.5} />
      </span>
      <span className="font-display text-lg font-bold tracking-tight">
        Power<span className="text-primary">Pulse</span>
      </span>
    </Link>
  );
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="rounded-full"
    >
      {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </Button>
  );
}
