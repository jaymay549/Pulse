import { Loader2, Users } from "lucide-react";
import type { VendorDealer } from "@/types/sales-targets";

const STATUS_BADGE: Record<string, string> = {
  "Confirmed User": "bg-green-500/10 text-green-400 border-green-500/30 font-bold",
  "Likely User": "bg-amber-500/10 text-amber-400 border-amber-500/30 font-bold",
  "Mentioned Only": "bg-zinc-800/50 text-zinc-500 border-zinc-700/50",
};

interface DealerSubTableProps {
  dealers: VendorDealer[] | undefined;
  isLoading: boolean;
}

export function DealerSubTable({ dealers, isLoading }: DealerSubTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 bg-zinc-950/50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-700" />
          <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">Verifying Evidence...</span>
        </div>
      </div>
    );
  }

  if (!dealers || dealers.length === 0) {
    return (
      <div className="py-12 text-center bg-zinc-950/50 border border-dashed border-zinc-900 rounded-lg">
        <span className="text-zinc-600 text-sm font-mono uppercase tracking-widest">No Dealer Records Found</span>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-zinc-950/50">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[9px] text-zinc-600 uppercase tracking-[0.2em] font-mono border-b border-zinc-900 bg-zinc-950">
            <th className="py-3 px-6">Dealer</th>
            <th className="py-3 px-6">Dealership</th>
            <th className="py-3 px-6 text-center">Status</th>
            <th className="py-3 px-6 text-center">Sentiment</th>
            <th className="py-3 px-6 text-center">Rooftops</th>
            <th className="py-3 px-6">Region</th>
            <th className="py-3 px-6 text-center">Switching?</th>
            <th className="py-3 px-6 text-center">Mentions</th>
          </tr>
        </thead>
        <tbody>
          {dealers.map((d) => (
            <tr
              key={d.member_id}
              className="border-b border-zinc-900/50 text-zinc-300 hover:bg-zinc-900/20 transition-colors"
            >
              <td className="py-3 px-6 font-semibold text-zinc-200">{d.name}</td>
              <td className="py-3 px-6 text-zinc-500 font-medium">
                {d.dealership_name || "—"}
              </td>
              <td className="py-3 px-6 text-center">
                <span
                  className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] uppercase tracking-wider border ${STATUS_BADGE[d.status]}`}
                >
                  {d.status}
                </span>
              </td>
              <td className="py-3 px-6 text-center font-mono font-bold text-zinc-400">
                {d.sentiment !== null
                  ? `${Math.round(d.sentiment)}/10`
                  : "—"}
              </td>
              <td className="py-3 px-6 text-center font-mono text-zinc-500">{d.rooftops ?? "—"}</td>
              <td className="py-3 px-6 text-zinc-500 font-medium">{d.region || "—"}</td>
              <td className="py-3 px-6 text-center">
                {d.status === "Confirmed User" && d.switching ? (
                  <span className="inline-flex items-center gap-1.5 text-red-500 font-bold font-mono text-[10px] uppercase">
                    <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                    Alert
                  </span>
                ) : (
                  <span className="text-zinc-700">—</span>
                )}
              </td>
              <td className="py-3 px-6 text-center font-mono font-bold text-zinc-200">{d.mention_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
