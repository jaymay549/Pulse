import { useState, useEffect } from "react";
import {
  ChevronRight,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
} from "lucide-react";
import type { SalesOpportunityRow, SalesOpportunitySignal, SalesSynopsis } from "@/types/sales-targets";
import { useSalesVendorDealers } from "@/hooks/useSalesVendorDealers";
import { DealerSubTable } from "./DealerSubTable";
import { AISynopsis } from "./AISynopsis";

interface SalesTargetsRowProps {
  row: SalesOpportunityRow;
  synopsisCache: Record<string, SalesSynopsis>;
  synopsisLoading: Record<string, boolean>;
  synopsisErrors: Record<string, string>;
  onGenerateSynopsis: (signal: SalesOpportunitySignal) => void;
  onRetrySynopsis: (signal: SalesOpportunitySignal) => void;
}

const TrendIcon = ({ direction }: { direction: string | null }) => {
  if (direction === "improving")
    return <TrendingUp className="h-4 w-4 text-green-400" />;
  if (direction === "declining")
    return <TrendingDown className="h-4 w-4 text-red-400" />;
  return <Minus className="h-4 w-4 text-zinc-500" />;
};

function scoreColor(score: number): string {
  if (score >= 70) return "text-red-400";
  if (score >= 40) return "text-amber-400";
  return "text-zinc-400";
}

function healthColor(score: number | null): string {
  if (score === null) return "text-zinc-500";
  if (score >= 70) return "text-green-400";
  if (score >= 50) return "text-amber-400";
  return "text-red-400";
}

export function SalesTargetsRow({
  row,
  synopsisCache,
  synopsisLoading,
  synopsisErrors,
  onGenerateSynopsis,
  onRetrySynopsis,
}: SalesTargetsRowProps) {
  const [expanded, setExpanded] = useState(false);
  const { data: dealers, isLoading: dealersLoading } = useSalesVendorDealers(
    row.vendor_name,
    expanded
  );

  useEffect(() => {
    if (expanded) {
      onGenerateSynopsis(row);
    }
  }, [expanded]);

  return (
    <>
      <tr
        className="border-b border-zinc-800 hover:bg-zinc-900/50 cursor-pointer transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-zinc-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-zinc-500" />
            )}
            <span className="font-medium text-zinc-100">{row.vendor_name}</span>
          </div>
        </td>
        <td className="py-3 px-4">
          {row.category ? (
            <span className="inline-block px-2 py-0.5 rounded text-xs bg-zinc-800 text-zinc-400 border border-zinc-700">
              {row.category}
            </span>
          ) : (
            <span className="text-zinc-600">—</span>
          )}
        </td>
        <td className="py-3 px-4 text-zinc-300">{row.mentions_30d}</td>
        <td className="py-3 px-4 text-zinc-400">{row.total_mentions}</td>
        <td className="py-3 px-4 text-zinc-300">{row.negative_pct}%</td>
        <td className="py-3 px-4 text-zinc-300">
          {row.nps_score !== null ? row.nps_score : "—"}
        </td>
        <td className={`py-3 px-4 ${healthColor(row.health_score)}`}>
          {row.health_score !== null ? Math.round(row.health_score) : "—"}
        </td>
        <td className="py-3 px-4">
          <TrendIcon direction={row.trend_direction} />
        </td>
        <td className="py-3 px-4 text-zinc-300">{row.feature_gap_count}</td>
        <td className="py-3 px-4 text-zinc-300">{row.known_dealers}</td>
        <td className="py-3 px-4">
          {row.has_profile ? (
            <CheckCircle2 className="h-4 w-4 text-green-400" />
          ) : (
            <span className="text-zinc-600">—</span>
          )}
        </td>
        <td className={`py-3 px-4 font-medium ${scoreColor(row.pain_score)}`}>
          {row.pain_score}
        </td>
        <td className={`py-3 px-4 font-medium ${scoreColor(row.buzz_score)}`}>
          {row.buzz_score}
        </td>
        <td className={`py-3 px-4 font-medium ${scoreColor(row.gap_score)}`}>
          {row.gap_score}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={14} className="bg-zinc-950 border-b border-zinc-800">
            <DealerSubTable dealers={dealers} isLoading={dealersLoading} />
            <div className="border-t border-zinc-800">
              <AISynopsis
                synopsis={synopsisCache[row.vendor_name]}
                isLoading={synopsisLoading[row.vendor_name] || false}
                error={synopsisErrors[row.vendor_name]}
                onRetry={() => onRetrySynopsis(row)}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
