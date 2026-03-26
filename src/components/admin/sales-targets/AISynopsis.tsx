import { Loader2, AlertCircle, RefreshCw, Sparkles, Target } from "lucide-react";
import type { SalesSynopsis } from "@/types/sales-targets";

interface AISynopsisProps {
  synopsis: SalesSynopsis | undefined;
  isLoading: boolean;
  error: string | undefined;
  onRetry: () => void;
}

export function AISynopsis({ synopsis, isLoading, error, onRetry }: AISynopsisProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-3 px-4 text-zinc-500 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Generating sales synopsis...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 py-3 px-4 text-red-400 text-sm">
        <AlertCircle className="h-4 w-4" />
        <span>{error}</span>
        <button
          onClick={onRetry}
          className="ml-2 flex items-center gap-1 text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </button>
      </div>
    );
  }

  if (!synopsis) return null;

  return (
    <div className="p-6 bg-zinc-950/50 border-r border-zinc-800 h-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-[0.2em]">
          <Sparkles className="h-3.5 w-3.5 text-zinc-400" />
          Strategic Briefing
        </div>
        <div className="h-px flex-1 bg-zinc-800 ml-4" />
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm text-zinc-400 leading-relaxed font-sans italic">
            "{synopsis.data_summary}"
          </p>
        </div>

        <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg space-y-3 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-1 opacity-20 group-hover:opacity-40 transition-opacity">
            <Target className="h-12 w-12 text-zinc-100" />
          </div>
          
          <div className="text-[10px] font-mono font-bold text-amber-500/80 uppercase tracking-widest flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            Pitch Angle
          </div>
          <p className="text-base text-zinc-100 font-bold leading-snug tracking-tight pr-8">
            {synopsis.pitch_angle}
          </p>
        </div>
      </div>
    </div>
  );
}
