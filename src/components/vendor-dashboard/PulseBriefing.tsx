import { useQuery } from "@tanstack/react-query";
import {
  ArrowUp,
  ArrowDown,
  Minus,
  MessageSquareQuote,
  Zap,
  BarChart2,
  Swords,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useVendorDataClient } from "@/hooks/useVendorDataClient";
import { fetchVendorPulseFeed } from "@/hooks/useSupabaseVendorData";
import { useVendorIntelligenceDashboard } from "@/hooks/useVendorIntelligenceDashboard";
import type { VendorDimension } from "@/hooks/useSupabaseVendorData";

// ── Types ─────────────────────────────────────────────────────

interface VendorStats {
  totalMentions: number;
  positiveCount: number;
  warningCount: number;
  positivePercent: number;
}

interface ComparedVendor {
  vendor_name: string;
  mention_count: number;
  positive_percent: number;
  co_occurrence_count: number | null;
}

interface RecentMention {
  id: string;
  quote: string;
  type: string;
  dimension: string | null;
  conversationTime: string | null;
}

interface PulseBriefingProps {
  vendorName: string;
  onNavigate: (section: string) => void;
}

// ── Helpers ───────────────────────────────────────────────────

const DIMENSION_LABELS: Record<string, string> = {
  reliable:   "Reliability",
  integrates: "Integration",
  support:    "Support",
  adopted:    "Adoption",
  worth_it:   "Value",
  other:      "General",
};

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function formatRelativeTime(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays < 1) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(dateString).toLocaleDateString();
}

function buildNarrative(
  stats: VendorStats,
  dimensions: VendorDimension[],
  topPositive: VendorDimension | null,
  topConcern: VendorDimension | null,
): string {
  const parts: string[] = [];

  if (stats.totalMentions === 0) {
    return "No dealer discussions yet. Once dealers start talking about you, insights will appear here.";
  }

  const mentionStr = `${stats.totalMentions} dealer discussion${stats.totalMentions !== 1 ? "s" : ""} about you`;
  parts.push(mentionStr);

  if (topPositive && topPositive.positive_percent >= 70) {
    const label = DIMENSION_LABELS[topPositive.dimension] ?? topPositive.dimension;
    parts.push(`strong praise for ${label}`);
  } else if (stats.positivePercent >= 70) {
    parts.push(`${stats.positivePercent}% positive overall`);
  }

  if (topConcern && topConcern.negative_count > 0) {
    const label = DIMENSION_LABELS[topConcern.dimension] ?? topConcern.dimension;
    parts.push(`${topConcern.negative_count} concern${topConcern.negative_count !== 1 ? "s" : ""} raised around ${label}`);
  } else if (stats.warningCount > 0) {
    parts.push(`${stats.warningCount} concern${stats.warningCount !== 1 ? "s" : ""} flagged`);
  }

  return parts.join(" · ") + ".";
}

// ── Sub-components ────────────────────────────────────────────

function HealthBadge({ score, trend }: { score: number | null; trend?: "up" | "down" | "stable" }) {
  if (score === null) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-3xl font-bold text-slate-300">—</span>
        <span className="text-xs text-slate-400">Gathering data</span>
      </div>
    );
  }

  const color = score >= 70 ? "text-emerald-600" : score >= 50 ? "text-amber-500" : "text-red-500";
  const ringColor = score >= 70 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  const dashOffset = 264 - (score / 100) * 264;

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center">
        <svg className="absolute inset-0" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r="24" fill="none" stroke="#f1f5f9" strokeWidth="4" />
          <circle
            cx="28" cy="28" r="24"
            fill="none"
            stroke={ringColor}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="151"
            strokeDashoffset={String(151 - (score / 100) * 151)}
            transform="rotate(-90 28 28)"
          />
        </svg>
        <span className={`text-sm font-bold ${color}`}>{score}</span>
      </div>

      <div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-slate-900">Health Score</span>
          {trend === "up" && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
              <ArrowUp className="h-2.5 w-2.5" /> Up
            </span>
          )}
          {trend === "down" && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600">
              <ArrowDown className="h-2.5 w-2.5" /> Down
            </span>
          )}
          {trend === "stable" && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
              <Minus className="h-2.5 w-2.5" /> Stable
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500">
          {score >= 70 ? "Strong performer" : score >= 50 ? "Room to improve" : "Needs attention"}
        </p>
      </div>
    </div>
  );
}

const QUOTE_STYLES: Record<string, { border: string; bg: string; text: string; badge: string }> = {
  positive: { border: "border-emerald-100", bg: "bg-emerald-50/60", text: "text-emerald-900", badge: "bg-emerald-100 text-emerald-700" },
  negative: { border: "border-red-100", bg: "bg-red-50/60", text: "text-red-900", badge: "bg-red-100 text-red-700" },
  warning: { border: "border-red-100", bg: "bg-red-50/60", text: "text-red-900", badge: "bg-red-100 text-red-700" },
  neutral: { border: "border-slate-100", bg: "bg-slate-50/60", text: "text-slate-900", badge: "bg-slate-100 text-slate-600" },
  mixed: { border: "border-amber-100", bg: "bg-amber-50/60", text: "text-amber-900", badge: "bg-amber-100 text-amber-700" },
};

function QuoteCard({ mention }: { mention: RecentMention }) {
  const style = QUOTE_STYLES[mention.type] ?? QUOTE_STYLES.neutral;
  const dimLabel = mention.dimension && mention.dimension !== "other"
    ? DIMENSION_LABELS[mention.dimension] ?? mention.dimension
    : null;

  return (
    <div className={`rounded-lg border p-4 ${style.border} ${style.bg}`}>
      <p className={`text-sm italic leading-relaxed ${style.text}`}>
        "{mention.quote}"
      </p>
      <div className="mt-2 flex items-center gap-2">
        {dimLabel && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${style.badge}`}>
            {dimLabel}
          </span>
        )}
        {mention.conversationTime && (
          <span className="text-[10px] text-slate-400">
            {formatRelativeTime(mention.conversationTime)}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────

export function PulseBriefing({ vendorName, onNavigate }: PulseBriefingProps) {
  const supabase = useVendorDataClient();

  // Profile stats — same query key as DashboardOverview
  const { data: profile } = useQuery({
    queryKey: ["vendor-profile", vendorName],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_vendor_profile_v3" as never,
        { p_vendor_name: vendorName, p_product_line_slug: null } as never
      );
      if (error) throw error;
      return data as unknown as { vendorName: string; stats: VendorStats };
    },
  });

  // Recent mentions — same query key as DashboardOverview
  const { data: mentions } = useQuery({
    queryKey: ["vendor-recent-mentions", vendorName],
    queryFn: async () => {
      const result = await fetchVendorPulseFeed({ vendorName, pageSize: 10 });
      return result.mentions.map((m) => ({
        id: String(m.id),
        quote: m.quote ?? "",
        type: m.type,
        dimension: (m as any).dimension ?? null,
        conversationTime: m.conversationTime ?? null,
      })) as RecentMention[];
    },
  });

  // Dimension data — same query key as DashboardDimensions
  const { data: dimensions } = useQuery<VendorDimension[]>({
    queryKey: ["dashboard-dimensions", vendorName],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_vendor_dimensions" as never,
        { p_vendor_name: vendorName } as never
      );
      if (error) throw error;
      return (data || []) as VendorDimension[];
    },
  });

  // Competitor data — same query key as DashboardIntel
  const { data: competitors } = useQuery<ComparedVendor[]>({
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

  // Intelligence (health score + recommendations) — shared cache
  const { data: intel } = useVendorIntelligenceDashboard(vendorName);

  const stats = profile?.stats;
  if (!stats) return null;

  // Derive dimension signals
  const validDims = (dimensions ?? []).filter(
    (d) => d.dimension !== "other" && d.mention_count >= 2
  );
  const sortedByPositive = [...validDims].sort(
    (a, b) => b.positive_percent - a.positive_percent
  );
  const topStrengths = sortedByPositive.filter((d) => d.positive_percent >= 65).slice(0, 2);
  const topConcernDim = [...validDims]
    .sort((a, b) => b.negative_count - a.negative_count)
    .find((d) => d.positive_percent < 60 && d.negative_count > 0) ?? null;

  // Narrative
  const narrative = buildNarrative(
    stats,
    validDims,
    sortedByPositive[0] ?? null,
    topConcernDim
  );

  // Pick one positive + one warning quote
  const positiveQuote = mentions?.find((m) => m.type === "positive" && m.quote.length > 20) ?? null;
  const warningQuote = mentions?.find((m) => (m.type === "warning" || m.type === "negative") && m.quote.length > 20) ?? null;

  // Health trend from intel history
  const history = intel?.sentiment_history ?? [];
  const withData = history.filter((h) => h.health_estimate !== null);
  let trendDir: "up" | "down" | "stable" = "stable";
  if (withData.length >= 2) {
    const delta =
      (withData[withData.length - 1].health_estimate ?? 0) -
      (withData[withData.length - 2].health_estimate ?? 0);
    if (delta > 3) trendDir = "up";
    else if (delta < -3) trendDir = "down";
  }

  // Top competitor
  const ownPositivePct = stats.positivePercent;
  const topCompetitor = (competitors ?? []).find(
    (c) => (c.positive_percent ?? 0) > ownPositivePct + 5
  ) ?? null;

  // Top 3 action items
  const topActions = (intel?.recommendations ?? []).slice(0, 3);

  return (
    <div className="space-y-4">
      {/* ── Section A: Health + Narrative ──────────────────────── */}
      <div className="rounded-xl border bg-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <HealthBadge score={intel?.metrics?.health_score ?? null} trend={trendDir} />

          {/* Stats inline */}
          <div className="flex flex-wrap gap-4 sm:justify-end">
            <div className="text-center">
              <div className="text-xl font-bold text-slate-900">{stats.totalMentions}</div>
              <div className="text-[11px] text-slate-400">Discussions</div>
            </div>
            <div className="text-center">
              <div className={`text-xl font-bold ${
                stats.positivePercent >= 70
                  ? "text-emerald-600"
                  : stats.positivePercent >= 50
                    ? "text-amber-500"
                    : "text-red-500"
              }`}>
                {stats.positivePercent}%
              </div>
              <div className="text-[11px] text-slate-400">Positive</div>
            </div>
            {stats.warningCount > 0 && (
              <div className="text-center">
                <div className="text-xl font-bold text-red-500">{stats.warningCount}</div>
                <div className="text-[11px] text-slate-400">Concerns</div>
              </div>
            )}
          </div>
        </div>

        {/* Narrative */}
        <p className="mt-3 text-sm text-slate-600 leading-relaxed border-t pt-3">{narrative}</p>
      </div>

      {/* ── Section B: What Dealers Are Saying ─────────────────── */}
      {(positiveQuote || warningQuote) && (
        <div className="rounded-xl border bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MessageSquareQuote className="h-4 w-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-900">What Dealers Are Saying</h3>
            </div>
            <button
              type="button"
              className="text-xs font-medium text-blue-600 hover:text-blue-800"
              onClick={() => onNavigate("mentions")}
            >
              See all →
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {positiveQuote && <QuoteCard mention={positiveQuote} />}
            {warningQuote && <QuoteCard mention={warningQuote} />}
          </div>
        </div>
      )}

      {/* ── Section C: Performance Signals ─────────────────────── */}
      {(topStrengths.length > 0 || topConcernDim) && (
        <div className="rounded-xl border bg-white p-5">
          <div className="flex items-center gap-2 mb-3">
            <BarChart2 className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-900">Performance Signals</h3>
          </div>

          <div className="flex flex-wrap gap-2">
            {topStrengths.map((d) => (
              <span
                key={d.dimension}
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {DIMENSION_LABELS[d.dimension] ?? d.dimension}
                <span className="text-emerald-500">{d.positive_percent}%</span>
              </span>
            ))}
            {topConcernDim && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                <AlertCircle className="h-3.5 w-3.5" />
                {DIMENSION_LABELS[topConcernDim.dimension] ?? topConcernDim.dimension} needs attention
                <span className="text-amber-500">{topConcernDim.positive_percent}%</span>
              </span>
            )}
          </div>

          <button
            type="button"
            className="mt-3 text-xs font-medium text-blue-600 hover:text-blue-800"
            onClick={() => onNavigate("dimensions")}
          >
            Full breakdown →
          </button>
        </div>
      )}

      {/* ── Section D: Competitive Snapshot ───────────────────── */}
      {topCompetitor && (
        <div className="rounded-xl border bg-white p-5">
          <div className="flex items-center gap-2 mb-2">
            <Swords className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-900">Competitive Snapshot</h3>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-amber-50 border border-amber-100 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-amber-900">
                {topCompetitor.vendor_name} leads by{" "}
                {Math.round((topCompetitor.positive_percent ?? 0) - ownPositivePct)}%
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                {topCompetitor.positive_percent}% positive vs your {ownPositivePct}%
                {topCompetitor.co_occurrence_count
                  ? ` · compared in ${topCompetitor.co_occurrence_count} conversations`
                  : ""}
              </p>
            </div>
            <button
              type="button"
              className="ml-3 flex-shrink-0 text-xs font-medium text-amber-700 hover:text-amber-900"
              onClick={() => onNavigate("intel")}
            >
              View →
            </button>
          </div>
        </div>
      )}

      {/* ── Section E: Top Actions ─────────────────────────────── */}
      {topActions.length > 0 && (
        <div className="rounded-xl border bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-900">Top Actions</h3>
            </div>
            <button
              type="button"
              className="text-xs font-medium text-blue-600 hover:text-blue-800"
              onClick={() => onNavigate("intelligence")}
            >
              Full action plan →
            </button>
          </div>

          <div className="space-y-2">
            {topActions.map((action) => {
              const dotColor =
                action.priority === "high"
                  ? "bg-red-500"
                  : action.priority === "medium"
                    ? "bg-amber-400"
                    : "bg-slate-300";
              return (
                <div key={action.id} className="flex items-start gap-3 text-sm">
                  <div className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${dotColor}`} />
                  <p className="text-slate-700 leading-relaxed">
                    {action.insight_text}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
