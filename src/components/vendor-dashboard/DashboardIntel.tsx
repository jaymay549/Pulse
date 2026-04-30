import { useQuery } from "@tanstack/react-query";
import { ArrowUp, ArrowDown, Minus, TrendingUp } from "lucide-react";
import { useClerkSupabase } from "@/hooks/useClerkSupabase";
import { useActiveProductLine } from "@/hooks/useActiveProductLine";
import { CompetitiveMovementCard } from "@/components/vendor-dashboard/CompetitiveMovementCard";
import { CompetitorLeaderboard } from "./competitor-leaderboard";
import { AnimateOnScroll } from "./AnimateOnScroll";
import { CountUp } from "./CountUp";

interface DashboardIntelProps {
  vendorName: string;
}

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

interface VendorTrend {
  currentPositivePct: number;
  previousPositivePct: number;
  direction: "up" | "down" | "stable";
  mentionVolumeChangePct: number;
}


function sentimentColor(percent: number): string {
  if (percent >= 70) return "text-emerald-600";
  if (percent >= 50) return "text-yellow-600";
  return "text-red-500";
}

function TrendBadge({ trend }: { trend: VendorTrend }) {
  const pct = trend.mentionVolumeChangePct;

  if (trend.direction === "up") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-600">
        <ArrowUp className="h-3 w-3" />
        {pct}%
      </span>
    );
  }

  if (trend.direction === "down") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-500">
        <ArrowDown className="h-3 w-3" />
        {pct}%
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
      <Minus className="h-3 w-3" />
      {pct}%
    </span>
  );
}

export function DashboardIntel({ vendorName }: DashboardIntelProps): JSX.Element {
  const supabase = useClerkSupabase();
  const { activeProductLine } = useActiveProductLine();
  const productLineSlug = activeProductLine?.slug ?? null;

  // Own profile stats
  const { data: ownProfile, isLoading: profileLoading } = useQuery({
    queryKey: ["intel-own-profile", vendorName, productLineSlug],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_vendor_profile_v3" as never,
        { p_vendor_name: vendorName, p_product_line_slug: productLineSlug } as never
      );
      if (error) throw error;
      return data as OwnProfile | null;
    },
  });

  // Trend
  const { data: trend } = useQuery({
    queryKey: ["vendor-trend", vendorName, productLineSlug],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_vendor_trend" as never,
        { p_vendor_name: vendorName } as never
      );
      if (error) throw error;
      return data as VendorTrend | null;
    },
  });

  if (profileLoading) {
    return <p className="text-sm text-slate-500">Loading intel...</p>;
  }

  if (!ownProfile) {
    return (
      <p className="text-sm text-slate-500">
        No data available for {vendorName}.
      </p>
    );
  }

  const stats = ownProfile.stats;
  const positivePct = stats.positivePercent ?? 0;

  return (
    <div>
      <AnimateOnScroll>
      <h1 className="text-2xl font-semibold text-slate-900">Market Intel</h1>
      <p className="mt-1 text-sm text-slate-500">
        Competitive intelligence from real dealer conversations
      </p>
      </AnimateOnScroll>

      {/* Your Position card */}
      <AnimateOnScroll delay={0.1}>
      <div className="mt-6 rounded-xl border bg-white p-6">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-slate-400" />
          <h2 className="text-lg font-medium text-slate-900">Your Position</h2>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4">
          {/* Total Discussions */}
          <div className="rounded-lg border bg-slate-50 p-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-slate-900">
                <CountUp value={stats.totalMentions} />
              </span>
              {trend && <TrendBadge trend={trend} />}
            </div>
            <p className="mt-1 text-xs text-slate-500">Total Discussions</p>
          </div>

          {/* Positive % */}
          <div className="rounded-lg border bg-slate-50 p-4">
            <span className={`text-2xl font-bold ${sentimentColor(positivePct)}`}>
              <CountUp value={positivePct} suffix="%" />
            </span>
            <p className="mt-1 text-xs text-slate-500">Positive Sentiment</p>
          </div>

          {/* Concerns */}
          <div className="rounded-lg border bg-slate-50 p-4">
            <span className="text-2xl font-bold text-red-500">
              <CountUp value={stats.warningCount} />
            </span>
            <p className="mt-1 text-xs text-slate-500">Concerns</p>
          </div>
        </div>
      </div>
      </AnimateOnScroll>

      {/* Competitor Leaderboard (CAR-19) */}
      <AnimateOnScroll delay={0.15}>
      <div className="mt-6">
        <CompetitorLeaderboard vendorName={vendorName} productLineSlug={productLineSlug} />
      </div>
      </AnimateOnScroll>

      {/* Competitive Movement */}
      <div className="mt-6">
        <CompetitiveMovementCard vendorName={vendorName} />
      </div>
    </div>
  );
}
