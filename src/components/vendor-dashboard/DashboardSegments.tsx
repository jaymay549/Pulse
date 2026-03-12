import { useState, useMemo } from "react";
import { Loader2, Users, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  useVendorSegmentIntel,
  AXIS_CONFIG,
  type SegmentAxis,
  type SegmentBucket,
} from "@/hooks/useVendorSegmentIntel";

interface DashboardSegmentsProps {
  vendorName: string;
}

// ─── Constants ───────────────────────────────────────────────

const AXIS_ORDER: SegmentAxis[] = ["size", "role", "geo", "oem"];

const DIMENSION_LABELS: Record<string, string> = {
  worth_it:   "Value",
  support:    "Support",
  integrates: "Integration",
  adopted:    "Adoption",
  reliable:   "Reliability",
  other:      "General",
};

function dimLabel(d: string) {
  return DIMENSION_LABELS[d] ?? d;
}

// ─── Helpers ─────────────────────────────────────────────────

/** Weighted average positive_pct across buckets in an axis */
function axisAvgPct(buckets: SegmentBucket[]): number {
  const totalMentions = buckets.reduce((s, b) => s + b.mentions, 0);
  if (totalMentions === 0) return 0;
  const weighted = buckets.reduce((s, b) => s + b.positive_pct * b.mentions, 0);
  return Math.round(weighted / totalMentions);
}

function sentimentColor(pct: number): string {
  if (pct >= 70) return "text-emerald-600";
  if (pct >= 50) return "text-amber-500";
  return "text-red-500";
}

function sentimentBg(pct: number): string {
  if (pct >= 70) return "bg-emerald-500";
  if (pct >= 50) return "bg-amber-400";
  return "bg-red-400";
}

// ─── Bucket Scorecard ────────────────────────────────────────

function BucketCard({
  bucket,
  axisAvg,
}: {
  bucket: SegmentBucket;
  axisAvg: number;
}) {
  const delta = bucket.positive_pct - axisAvg;
  const absDelta = Math.abs(delta);
  const wins  = bucket.wins.slice(0, 3);
  const flags = bucket.flags.slice(0, 3);

  return (
    <div className="rounded-xl border border-border/50 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col">
      {/* Card header */}
      <div className="px-5 pt-4 pb-3 border-b border-border/30">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-[15px] font-semibold text-slate-900 leading-tight">
              {bucket.bucket}
            </h3>
            <p className="mt-0.5 text-[12px] text-slate-400">
              {bucket.mentions} mention{bucket.mentions !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Delta badge */}
          {absDelta >= 5 && (
            <span
              className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold shrink-0 ${
                delta > 0
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-red-50 text-red-600"
              }`}
            >
              {delta > 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {delta > 0 ? "+" : "−"}{absDelta} pts vs avg
            </span>
          )}
          {absDelta < 5 && (
            <span className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-500 shrink-0">
              <Minus className="h-3 w-3" />
              avg
            </span>
          )}
        </div>

        {/* Sentiment bar */}
        <div className="mt-3 flex items-center gap-3">
          <span className={`text-2xl font-bold tabular-nums ${sentimentColor(bucket.positive_pct)}`}>
            {bucket.positive_pct}%
          </span>
          <div className="flex-1">
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${sentimentBg(bucket.positive_pct)}`}
                style={{ width: `${bucket.positive_pct}%` }}
              />
            </div>
            <p className="mt-0.5 text-[10px] text-slate-400">positive sentiment</p>
          </div>
        </div>
      </div>

      {/* Quotes */}
      <div className="flex-1 px-5 py-3 space-y-2">
        {wins.length === 0 && flags.length === 0 && (
          <p className="text-[12px] text-slate-400 italic">No specific feedback quotes yet.</p>
        )}

        {flags.map((f, i) => (
          <div key={`flag-${i}`} className="flex items-start gap-2">
            <span className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
            <div className="min-w-0">
              <p className="text-[12px] text-slate-700 leading-snug line-clamp-2 italic">
                "{f.headline}"
              </p>
              <span className="mt-0.5 inline-block text-[10px] text-slate-400">
                {dimLabel(f.dimension)}
              </span>
            </div>
          </div>
        ))}

        {wins.map((w, i) => (
          <div key={`win-${i}`} className="flex items-start gap-2">
            <span className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
            <div className="min-w-0">
              <p className="text-[12px] text-slate-700 leading-snug line-clamp-2 italic">
                "{w.headline}"
              </p>
              <span className="mt-0.5 inline-block text-[10px] text-slate-400">
                {dimLabel(w.dimension)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Axis Panel ──────────────────────────────────────────────

function AxisPanel({ buckets }: { buckets: SegmentBucket[] }) {
  const avg = useMemo(() => axisAvgPct(buckets), [buckets]);
  const totalMentions = buckets.reduce((s, b) => s + b.mentions, 0);

  // Sort: biggest delta first (most interesting), then by mention count
  const sorted = useMemo(
    () => [...buckets].sort((a, b) => Math.abs(b.positive_pct - avg) - Math.abs(a.positive_pct - avg)),
    [buckets, avg]
  );

  return (
    <div>
      {/* Axis summary bar */}
      <div className="mb-4 flex items-center gap-4 text-[13px] text-slate-500">
        <span>
          <span className={`font-semibold ${sentimentColor(avg)}`}>{avg}%</span> avg positive
        </span>
        <span className="text-slate-300">·</span>
        <span>{totalMentions} attributed mention{totalMentions !== 1 ? "s" : ""}</span>
        <span className="text-slate-300">·</span>
        <span>{sorted.length} segment{sorted.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((b) => (
          <BucketCard key={b.bucket} bucket={b} axisAvg={avg} />
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────

export function DashboardSegments({ vendorName }: DashboardSegmentsProps) {
  const { data: intel, isLoading, isError } = useVendorSegmentIntel(vendorName);

  // Only include axes that have at least one bucket
  const activeAxes = useMemo<SegmentAxis[]>(() => {
    if (!intel) return [];
    return AXIS_ORDER.filter((a) => intel.axes[a].length > 0);
  }, [intel]);

  const [activeTab, setActiveTab] = useState<SegmentAxis | null>(null);

  // Auto-select first available axis
  const tab: SegmentAxis | null = activeTab && activeAxes.includes(activeTab)
    ? activeTab
    : activeAxes[0] ?? null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (isError || !intel) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-700">Failed to load segment data. Please try refreshing.</p>
      </div>
    );
  }

  if (intel.total_attributed < 3 || activeAxes.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Audience Segments</h1>
        <div className="mt-6 rounded-xl border border-border/50 bg-white p-10 text-center">
          <Users className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">
            Segment insights will appear as more dealer feedback is attributed.
          </p>
          <p className="mt-1 text-[12px] text-slate-400">
            {intel.total_attributed} attributed mention{intel.total_attributed !== 1 ? "s" : ""} so far
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Audience Segments</h1>
        <p className="mt-1 text-sm text-slate-500">
          How sentiment varies across different types of dealers —{" "}
          {intel.total_attributed} attributed mention{intel.total_attributed !== 1 ? "s" : ""}
        </p>
        {intel.standout && (
          <p className="mt-2 text-[13px] text-slate-600 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 inline-block">
            ✦ {intel.standout}
          </p>
        )}
      </div>

      {/* Axis tabs */}
      <div className="flex gap-1 border-b border-border/50">
        {activeAxes.map((axis) => {
          const cfg = AXIS_CONFIG[axis];
          const isActive = tab === axis;
          return (
            <button
              key={axis}
              type="button"
              onClick={() => setActiveTab(axis)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                isActive
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-400 hover:text-slate-700"
              }`}
            >
              {cfg.label}
              <span className="ml-1.5 text-[11px] text-slate-400">
                ({intel.axes[axis].length})
              </span>
            </button>
          );
        })}
      </div>

      {/* Active axis panel */}
      {tab && <AxisPanel buckets={intel.axes[tab]} />}
    </div>
  );
}
