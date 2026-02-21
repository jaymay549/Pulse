import { useQuery } from "@tanstack/react-query";
import { useClerkSupabase } from "@/hooks/useClerkSupabase";
import { Badge } from "@/components/ui/badge";

interface VendorIntelPanelProps {
  vendorName: string;
}

// Matches the nested stats object returned by get_vendor_profile
interface OwnProfileStats {
  totalMentions: number;
  positiveCount: number;
  warningCount: number;
  positivePercent: number;
  warningPercent: number;
}

interface OwnProfile {
  vendorName: string;
  stats: OwnProfileStats;
}

// Matches each element in the vendors array returned by get_compared_vendors
interface ComparedVendor {
  vendor_name: string;
  mention_count: number;
  positive_percent: number;
  co_occurrence_count: number | null;
}

export function VendorIntelPanel({ vendorName }: VendorIntelPanelProps) {
  const supabase = useClerkSupabase();

  // Fetch own stats via get_vendor_profile (parameter: p_vendor_name)
  // Returns JSONB: { vendorName, stats: { totalMentions, positiveCount, positivePercent, ... }, ... }
  const { data: ownProfile, isLoading: profileLoading } = useQuery({
    queryKey: ["intel-own-profile", vendorName],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_vendor_profile" as never,
        { p_vendor_name: vendorName } as never
      );
      if (error) throw error;
      return data as OwnProfile | null;
    },
  });

  // Fetch competitor comparison via get_compared_vendors (parameters: p_vendor_name, p_limit)
  // Returns JSONB: { vendors: [ { vendor_name, mention_count, positive_percent, co_occurrence_count } ] }
  const { data: competitors = [], isLoading: competitorsLoading } = useQuery<
    ComparedVendor[]
  >({
    queryKey: ["intel-competitors", vendorName],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_compared_vendors" as never,
        { p_vendor_name: vendorName, p_limit: 4 } as never
      );
      if (error) throw error;
      return ((data as any)?.vendors ?? []) as ComparedVendor[];
    },
  });

  if (profileLoading || competitorsLoading) {
    return (
      <p className="text-sm text-muted-foreground">Loading intel…</p>
    );
  }

  if (!ownProfile) {
    return (
      <p className="text-sm text-muted-foreground">
        No data available for {vendorName}.
      </p>
    );
  }

  // positivePercent is returned directly by the RPC as a rounded integer
  const ownPositivePct = ownProfile.stats.positivePercent ?? 0;

  const rows = [
    {
      name: ownProfile.vendorName,
      mentions: ownProfile.stats.totalMentions,
      positivePct: ownPositivePct,
      isOwn: true,
    },
    ...competitors.map(c => ({
      name: c.vendor_name,
      mentions: c.mention_count,
      // positive_percent is a ready-made rounded integer from the RPC
      positivePct: c.positive_percent ?? 0,
      isOwn: false,
    })),
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        How you compare to vendors dealers mention alongside you.
      </p>
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-xs uppercase tracking-wide text-muted-foreground">
                Vendor
              </th>
              <th className="text-right px-4 py-2.5 font-medium text-xs uppercase tracking-wide text-muted-foreground">
                Mentions
              </th>
              <th className="text-right px-4 py-2.5 font-medium text-xs uppercase tracking-wide text-muted-foreground">
                Positive %
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(row => (
              <tr
                key={`${row.isOwn ? "own" : "comp"}-${row.name}`}
                className={row.isOwn ? "bg-primary/5 font-medium" : ""}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {row.name}
                    {row.isOwn && (
                      <Badge variant="outline" className="text-xs py-0">
                        You
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                  {row.mentions}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  <span
                    className={
                      row.positivePct >= 70
                        ? "text-emerald-600"
                        : row.positivePct >= 50
                        ? "text-yellow-600"
                        : "text-red-500"
                    }
                  >
                    {row.positivePct}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
