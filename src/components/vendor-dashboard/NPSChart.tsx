import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { CountUp } from "./CountUp";

interface NPSChartProps {
  promoterCount: number;
  passiveCount: number;
  detractorCount: number;
}

export function NPSChart({ promoterCount, passiveCount, detractorCount }: NPSChartProps) {
  const total = promoterCount + passiveCount + detractorCount;
  const npsScore = total > 0 ? Math.round(((promoterCount - detractorCount) / total) * 100) : null;

  const promoterPct = total > 0 ? (promoterCount / total) * 100 : 0;
  const passivePct = total > 0 ? (passiveCount / total) * 100 : 0;
  const detractorPct = total > 0 ? (detractorCount / total) * 100 : 0;

  return (
    <div className="bg-white rounded-2xl border border-yellow-400 p-6 shadow-sm flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-[15px] font-extrabold text-slate-900 tracking-tight">Dealer NPS</h3>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="text-slate-300 hover:text-slate-500 transition-colors">
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[280px] p-3 shadow-xl border-slate-200">
                <div className="space-y-2">
                  <p className="font-bold text-slate-900 text-[13px]">Net Promoter Score</p>
                  <p className="text-[12px] leading-relaxed text-slate-600">
                    Calculated by subtracting the percentage of Detractors from the percentage of Promoters.
                  </p>
                  <div className="pt-2 space-y-1.5 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="text-[11px] text-slate-500"><strong className="text-slate-700">Promoters:</strong> Enthusiastic & loyal</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-slate-300" />
                      <span className="text-[11px] text-slate-500"><strong className="text-slate-700">Passives:</strong> Satisfied but indifferent</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-red-400" />
                      <span className="text-[11px] text-slate-500"><strong className="text-slate-700">Detractors:</strong> Unhappy & at risk</span>
                    </div>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
          Last 90 Days
        </div>
      </div>

      <div className="flex flex-col items-center justify-center flex-1 py-4">
        <div className={cn(
          "text-6xl font-black tracking-tighter tabular-nums mb-1",
          npsScore === null ? "text-slate-200" : 
          npsScore >= 30 ? "text-yellow-500" :
          npsScore >= 0 ? "text-gray-500" : "text-slate-900"
        )}>
          {npsScore !== null ? (npsScore > 0 ? <CountUp value={npsScore} prefix="+" duration={1.5} /> : <CountUp value={npsScore} duration={1.5} />) : "—"}
        </div>
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
          Aggregate Score
        </div>
      </div>

      <div className="mt-auto space-y-3">
        {/* Distribution Bar */}
        <div className="flex h-3 w-full rounded-full overflow-hidden bg-slate-100 shadow-inner">
          {promoterPct > 0 && (
            <div
              className="bg-yellow-400 transition-all duration-1000 ease-out"
              style={{ width: `${promoterPct}%` }}
            />
          )}
          {passivePct > 0 && (
            <div
              className="bg-gray-300 transition-all duration-1000 ease-out"
              style={{ width: `${passivePct}%` }}
            />
          )}
          {detractorPct > 0 && (
            <div
              className="bg-slate-800 transition-all duration-1000 ease-out"
              style={{ width: `${detractorPct}%` }}
            />
          )}
        </div>

        {/* Legend */}
        <div className="flex justify-between items-center px-1">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-yellow-600 uppercase tracking-tight">Promoters</span>
            <span className="text-[13px] font-black text-slate-900"><CountUp value={promoterCount} /></span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Passive</span>
            <span className="text-[13px] font-black text-slate-900"><CountUp value={passiveCount} /></span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-slate-800 uppercase tracking-tight">Detractors</span>
            <span className="text-[13px] font-black text-slate-900"><CountUp value={detractorCount} /></span>
          </div>
        </div>
      </div>
    </div>
  );
}
