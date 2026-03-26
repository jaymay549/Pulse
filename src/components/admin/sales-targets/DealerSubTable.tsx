import { Loader2, Users } from "lucide-react";
import type { VendorDealer } from "@/types/sales-targets";

const STATUS_BADGE: Record<string, string> = {
  "Confirmed User": "bg-green-900/50 text-green-400 border-green-800",
  "Likely User": "bg-amber-900/50 text-amber-400 border-amber-800",
  "Mentioned Only": "bg-zinc-800 text-zinc-400 border-zinc-700",
};

interface DealerSubTableProps {
  dealers: VendorDealer[] | undefined;
  isLoading: boolean;
}

export function DealerSubTable({ dealers, isLoading }: DealerSubTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-3 px-4 text-zinc-500 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading dealers...
      </div>
    );
  }

  if (!dealers || dealers.length === 0) {
    return (
      <div className="py-3 px-4 text-zinc-500 text-sm">
        No known dealers for this vendor.
      </div>
    );
  }

  return (
    <div className="py-3 px-4">
      <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
        <Users className="h-3 w-3" />
        Known Dealers ({dealers.length})
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
              <th className="py-2 pr-4">Dealer</th>
              <th className="py-2 pr-4">Dealership</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Sentiment</th>
              <th className="py-2 pr-4">Rooftops</th>
              <th className="py-2 pr-4">Region</th>
              <th className="py-2 pr-4">Switching?</th>
              <th className="py-2">Mentions</th>
            </tr>
          </thead>
          <tbody>
            {dealers.map((d) => (
              <tr
                key={d.member_id}
                className="border-b border-zinc-800/50 text-zinc-300"
              >
                <td className="py-2 pr-4">{d.name}</td>
                <td className="py-2 pr-4 text-zinc-400">
                  {d.dealership_name || "—"}
                </td>
                <td className="py-2 pr-4">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs border ${STATUS_BADGE[d.status]}`}
                  >
                    {d.status}
                  </span>
                </td>
                <td className="py-2 pr-4">
                  {d.sentiment !== null
                    ? `${Math.round(d.sentiment)}/10`
                    : "—"}
                </td>
                <td className="py-2 pr-4">{d.rooftops ?? "—"}</td>
                <td className="py-2 pr-4 text-zinc-400">{d.region || "—"}</td>
                <td className="py-2 pr-4">
                  {d.status === "Confirmed User" && d.switching ? (
                    <span className="text-red-400 font-medium">Yes</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-2">{d.mention_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
