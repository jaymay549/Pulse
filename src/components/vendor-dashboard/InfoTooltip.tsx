import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface InfoTooltipProps {
  content: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
}

export function InfoTooltip({ content, side = "top" }: InfoTooltipProps) {
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center text-slate-300 hover:text-slate-500 transition-colors focus:outline-none"
          tabIndex={-1}
          aria-label="More info"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side={side}
        className="max-w-xs text-xs leading-relaxed whitespace-normal"
      >
        {content}
      </TooltipContent>
    </Tooltip>
  );
}
