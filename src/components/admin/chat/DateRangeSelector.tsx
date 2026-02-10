import { Calendar, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { DateRangePreset } from "@/types/admin";

const PRESET_LABELS: Record<DateRangePreset, string> = {
  last7days: "Last 7 days",
  last1day: "Last 1 day",
  all: "All time",
  custom: "Custom",
};

interface DateRangeSelectorProps {
  preset: DateRangePreset;
  onPresetChange: (preset: DateRangePreset) => void;
  customStart?: string;
  customEnd?: string;
  onCustomStartChange?: (date: string) => void;
  onCustomEndChange?: (date: string) => void;
}

const DateRangeSelector = ({
  preset,
  onPresetChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
}: DateRangeSelectorProps) => {
  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="text-xs bg-zinc-900 border-zinc-700 text-zinc-300">
            <Calendar className="h-3.5 w-3.5 mr-1.5" />
            {PRESET_LABELS[preset]}
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-zinc-900 border-zinc-700">
          {(Object.keys(PRESET_LABELS) as DateRangePreset[]).map((p) => (
            <DropdownMenuItem
              key={p}
              onClick={() => onPresetChange(p)}
              className={`text-xs ${preset === p ? "bg-zinc-800 text-zinc-100" : "text-zinc-400"}`}
            >
              {PRESET_LABELS[p]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {preset === "custom" && (
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            value={customStart || ""}
            onChange={(e) => onCustomStartChange?.(e.target.value)}
            className="h-8 text-xs bg-zinc-900 border-zinc-700 text-zinc-300 w-32"
          />
          <span className="text-zinc-500 text-xs">to</span>
          <Input
            type="date"
            value={customEnd || ""}
            onChange={(e) => onCustomEndChange?.(e.target.value)}
            className="h-8 text-xs bg-zinc-900 border-zinc-700 text-zinc-300 w-32"
          />
        </div>
      )}
    </div>
  );
};

export default DateRangeSelector;
