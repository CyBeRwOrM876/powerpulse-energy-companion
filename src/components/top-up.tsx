import { useState } from "react";
import { toast } from "sonner";
import { BatteryCharging } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTelemetry } from "@/lib/telemetry";
import { useProfile } from "@/hooks/use-profile";
import { formatKwacha } from "@/lib/energy";

export function TopUpButton() {
  const t = useTelemetry();
  const profile = useProfile();
  const [open, setOpen] = useState(false);
  const [units, setUnits] = useState("100");
  const n = Number(units);

  async function save() {
    if (!Number.isFinite(n) || n <= 0 || n > 100000) { toast.error("Enter units between 1 and 100,000"); return; }
    await t.topUp(n);
    toast.success(`Added ${n} units`);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="hero">
          <BatteryCharging /> Top up units
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Record a units top-up</DialogTitle>
          <DialogDescription>Enter the kWh units from your ZESCO prepaid token.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="units">Units (kWh)</Label>
          <Input id="units" type="number" min={1} className="h-11 font-mono" value={units} onChange={(e) => setUnits(e.target.value)} />
          <p className="text-xs text-muted-foreground">
            Roughly {formatKwacha((Number.isFinite(n) ? n : 0) * Number(profile.tariff_per_kwh))} at your tariff.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[50, 100, 250, 500].map((v) => (
            <Button key={v} type="button" variant="soft" size="sm" onClick={() => setUnits(String(v))}>
              +{v}
            </Button>
          ))}
        </div>
        <Button variant="hero" onClick={save}>
          Add units
        </Button>
      </DialogContent>
    </Dialog>
  );
}
