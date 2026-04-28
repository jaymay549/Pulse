import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActiveProductLine } from "@/hooks/useActiveProductLine";

/**
 * Compact header dropdown for switching between subscribed product lines (D-08).
 * Hidden when vendor has 0 or 1 subscriptions (no choice to make).
 */
export function VendorProductLineSwitcher() {
  const { activeProductLine, setActiveProductLine, subscriptions } =
    useActiveProductLine();

  if (subscriptions.length <= 1) return null;

  return (
    <Select
      value={activeProductLine?.slug ?? ""}
      onValueChange={(slug) => {
        const found = subscriptions.find((s) => s.slug === slug);
        if (found) setActiveProductLine(found);
      }}
    >
      <SelectTrigger className="h-8 w-[180px] text-xs bg-zinc-800/50 border-zinc-700 text-zinc-200">
        <SelectValue placeholder="Select product line" />
      </SelectTrigger>
      <SelectContent>
        {subscriptions.map((s) => (
          <SelectItem key={s.slug} value={s.slug}>
            {s.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
