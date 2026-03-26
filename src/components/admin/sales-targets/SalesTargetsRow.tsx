import { useState, useEffect } from "react";
import {
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import type { SalesOpportunityRow, SalesOpportunitySignal, SalesSynopsis } from "@/types/sales-targets";
import { useSalesVendorDealers } from "@/hooks/useSalesVendorDealers";
import { DealerSubTable } from "./DealerSubTable";
import { AISynopsis } from "./AISynopsis";
import { ScoreLevelIndicator } from "./ScoreLevelIndicator";
import { TrendPulse } from "./TrendPulse";

interface SalesTargetsRowProps {
  row: SalesOpportunityRow;
  synopsisCache: Record<string, SalesSynopsis>;
  synopsisLoading: Record<string, boolean>;
  synopsisErrors: Record<string, string>;
  onGenerateSynopsis: (signal: SalesOpportunitySignal) => void;
  onRetrySynopsis: (signal: SalesOpportunitySignal) => void;
}

function scoreColor(score: number): string {
  if (score >= 70) return "bg-red-400";
  if (score >= 40) return "bg-amber-400";
  return "bg-zinc-400";
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
        className="border-b border-zinc-800/50 hover:bg-zinc-900/40 cursor-pointer transition-all duration-200 group relative"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="py-4 px-4 min-w-[300px]">
          <div className="flex items-center gap-3">
            <div className="w-4 flex items-center justify-center">
              {expanded ? (
                <ChevronDown className="h-4 w-4 text-zinc-500" />
              ) : (
                <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400" />
              )}
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-zinc-100 tracking-tight leading-tight">
                {row.vendor_name}
              </span>
              {row.category && (
                <span className="text-[10px] uppercase tracking-widest text-zinc-500 mt-1">
                  {row.category}
                </span>
              )}
            </div>
          </div>
        </td>
        
        <td className="py-4 px-4">
          <div className="flex items-center gap-6">
            <ScoreLevelIndicator 
              score={row.pain_score} 
              label="Pain" 
              colorClass={scoreColor(row.pain_score)} 
            />
            <ScoreLevelIndicator 
              score={row.buzz_score} 
              label="Buzz" 
              colorClass="bg-blue-400" 
            />
            <ScoreLevelIndicator 
              score={row.gap_score} 
              label="Gap" 
              colorClass="bg-purple-400" 
            />
          </div>
        </td>

        <td className="py-4 px-4">
          <TrendPulse direction={row.trend_direction} />
        </td>

        <td className="py-4 px-4">
          <div className="flex flex-col">
            <span className="text-sm font-mono font-bold text-zinc-200">
              {row.mentions_30d}
            </span>
            <span className="text-[9px] uppercase text-zinc-600 font-mono">
              30d mentions
            </span>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={4} className="bg-zinc-950 p-0 border-b border-zinc-800">
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
