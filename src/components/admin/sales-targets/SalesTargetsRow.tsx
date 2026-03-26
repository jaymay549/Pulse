import { useState, useEffect } from "react";
import {
  ChevronRight,
  ChevronDown,
  Target as TargetIcon,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  UserPlus,
  Users,
  AlertTriangle,
  Heart,
  Activity,
  UserCheck,
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
        className="border-b border-zinc-800/50 hover:bg-zinc-900/40 cursor-pointer transition-all duration-200 group relative target-row-hover"
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
            <div className="flex flex-col">
              {/* Strategic briefing grid */}
              <div className="grid grid-cols-1 lg:grid-cols-10 gap-0">
                <div className="lg:col-span-4 border-r border-zinc-900">
                  <AISynopsis
                    synopsis={synopsisCache[row.vendor_name]}
                    isLoading={synopsisLoading[row.vendor_name] || false}
                    error={synopsisErrors[row.vendor_name]}
                    onRetry={() => onRetrySynopsis(row)}
                  />
                </div>
                
                <div className="lg:col-span-6 p-6 bg-zinc-950/30">
                  <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-[0.2em] mb-6">
                    <Activity className="h-3.5 w-3.5 text-zinc-400" />
                    Vital Signs
                    <div className="h-px flex-1 bg-zinc-900 ml-4" />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div className="p-3 bg-zinc-900/40 border border-zinc-800 rounded-lg flex flex-col gap-1 group transition-colors hover:border-zinc-700">
                      <div className="flex items-center gap-2 text-[9px] font-mono text-zinc-500 uppercase tracking-widest">
                        <Heart className="h-3 w-3" />
                        Health Score
                      </div>
                      <span className={`text-lg font-bold font-mono ${
                        (row.health_score || 0) >= 70 ? 'text-green-400' : (row.health_score || 0) >= 40 ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {row.health_score !== null ? Math.round(row.health_score) : '—'}
                      </span>
                    </div>

                    <div className="p-3 bg-zinc-900/40 border border-zinc-800 rounded-lg flex flex-col gap-1 group transition-colors hover:border-zinc-700">
                      <div className="flex items-center gap-2 text-[9px] font-mono text-zinc-500 uppercase tracking-widest">
                        <TrendingUp className="h-3 w-3" />
                        NPS Score
                      </div>
                      <span className={`text-lg font-bold font-mono ${
                        (row.nps_score || 0) >= 30 ? 'text-green-400' : (row.nps_score || 0) >= 0 ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {row.nps_score !== null ? row.nps_score : '—'}
                      </span>
                    </div>

                    <div className="p-3 bg-zinc-900/40 border border-zinc-800 rounded-lg flex flex-col gap-1 group transition-colors hover:border-zinc-700">
                      <div className="flex items-center gap-2 text-[9px] font-mono text-zinc-500 uppercase tracking-widest">
                        <AlertTriangle className="h-3 w-3" />
                        Feature Gaps
                      </div>
                      <span className="text-lg font-bold font-mono text-zinc-100">
                        {row.feature_gap_count}
                      </span>
                    </div>

                    <div className="p-3 bg-zinc-900/40 border border-zinc-800 rounded-lg flex flex-col gap-1 group transition-colors hover:border-zinc-700">
                      <div className="flex items-center gap-2 text-[9px] font-mono text-zinc-500 uppercase tracking-widest">
                        <Users className="h-3 w-3" />
                        Known Dealers
                      </div>
                      <span className="text-lg font-bold font-mono text-zinc-100">
                        {row.known_dealers}
                      </span>
                    </div>

                    <div className="p-3 bg-zinc-900/40 border border-zinc-800 rounded-lg flex flex-col gap-1 group transition-colors hover:border-zinc-700">
                      <div className="flex items-center gap-2 text-[9px] font-mono text-zinc-500 uppercase tracking-widest">
                        <UserPlus className="h-3 w-3" />
                        Total Mentions
                      </div>
                      <span className="text-lg font-bold font-mono text-zinc-100">
                        {row.total_mentions}
                      </span>
                    </div>

                    <div className="p-3 bg-zinc-900/40 border border-zinc-800 rounded-lg flex flex-col gap-1 group transition-colors hover:border-zinc-700">
                      <div className="flex items-center gap-2 text-[9px] font-mono text-zinc-500 uppercase tracking-widest">
                        <ShieldCheck className="h-3 w-3" />
                        Profile
                      </div>
                      <span className={`text-sm font-bold font-mono uppercase tracking-tighter pt-1.5 ${row.has_profile ? 'text-green-500' : 'text-zinc-600'}`}>
                        {row.has_profile ? 'Claimed' : 'Cold Prospect'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dealer Proof (Proof of users) */}
              <div className="border-t border-zinc-900 bg-zinc-950/80 p-6">
                <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-[0.2em] mb-4">
                  <UserCheck className="h-3.5 w-3.5 text-zinc-400" />
                  Dealer Evidence & Proof
                  <div className="h-px flex-1 bg-zinc-900 ml-4" />
                </div>
                <div className="rounded-xl border border-zinc-900 overflow-hidden shadow-2xl">
                  <DealerSubTable dealers={dealers} isLoading={dealersLoading} />
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
