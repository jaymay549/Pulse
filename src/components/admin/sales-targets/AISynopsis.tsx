import { Loader2, AlertCircle, RefreshCw, Sparkles } from "lucide-react";
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
    <div className="py-3 px-4 space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">
        <Sparkles className="h-3 w-3" />
        AI Sales Synopsis
      </div>
      <p className="text-sm text-zinc-300">{synopsis.data_summary}</p>
      <p className="text-sm text-amber-400 font-medium">{synopsis.pitch_angle}</p>
    </div>
  );
}
