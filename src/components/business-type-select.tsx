import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BUSINESS_LIST } from "@/lib/business";

export function BusinessTypeSelect({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  id?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="h-11 w-full bg-card">
        <SelectValue placeholder="Choose your type of business" />
      </SelectTrigger>
      <SelectContent>
        {BUSINESS_LIST.map((b) => (
          <SelectItem key={b.id} value={b.id}>
            <span className="mr-2">{b.emoji}</span>
            {b.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
