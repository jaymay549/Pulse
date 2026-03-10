import { useMemo } from "react";
import {
  Loader2,
  Users,
  Lightbulb,
  ThumbsUp,
  ThumbsDown,
  ShieldAlert,
  ShieldCheck,
  ShieldMinus,
} from "lucide-react";
import {
  useVendorSegmentIntel,
  AXIS_CONFIG,
  type SegmentAxis,
  type SegmentBucket,
} from "@/hooks/useVendorSegmentIntel";

interface DashboardSegmentsProps {
  vendorName: string;
}

// ─── Types ───────────────────────────────────────────────────

interface FlatHeadline {
  headline: string;
  type: "win" | "flag";
  dimension: string;
  /** Unique segment labels that surfaced this headline */
  segments: string[];
}

interface ThemeGroup {
  dimension: string;
  label: string;
  items: FlatHeadline[];
  flagCount: number;
  winCount: number;
  suggestedAction: string;
}

// ─── Constants ───────────────────────────────────────────────

const AXIS_ORDER: SegmentAxis[] = ["size", "role", "geo", "oem"];

const DIMENSION_DISPLAY: Record<string, { label: string; order: number }> = {
  integrates: { label: "Integration", order: 1 },
  support: { label: "Support & Training", order: 2 },
  worth_it: { label: "Pricing & Value", order: 3 },
  adopted: { label: "Adoption & Onboarding", order: 4 },
  reliable: { label: "Reliability", order: 5 },
  other: { label: "General Feedback", order: 99 },
};

function dimLabel(dim: string): string {
  return DIMENSION_DISPLAY[dim]?.label ?? dim;
}

// ─── Flatten & Group Logic ───────────────────────────────────

function buildThemeGroups(
  axes: Record<SegmentAxis, SegmentBucket[]>,
): ThemeGroup[] {
  // 1. Flatten all headlines across every axis/bucket, dedup by headline text
  const map = new Map<string, FlatHeadline>();

  for (const axis of AXIS_ORDER) {
    const axisLabel = AXIS_CONFIG[axis].label;
    for (const bucket of axes[axis]) {
      const segTag = `${bucket.bucket} (${axisLabel})`;

      for (const w of bucket.wins) {
        const key = `win::${w.headline}`;
        const existing = map.get(key);
        if (existing) {
          if (!existing.segments.includes(segTag)) existing.segments.push(segTag);
        } else {
          map.set(key, { headline: w.headline, type: "win", dimension: w.dimension, segments: [segTag] });
        }
      }
      for (const f of bucket.flags) {
        const key = `flag::${f.headline}`;
        const existing = map.get(key);
        if (existing) {
          if (!existing.segments.includes(segTag)) existing.segments.push(segTag);
        } else {
          map.set(key, { headline: f.headline, type: "flag", dimension: f.dimension, segments: [segTag] });
        }
      }
    }
  }

  // 2. Group by dimension
  const grouped = new Map<string, FlatHeadline[]>();
  for (const item of map.values()) {
    const list = grouped.get(item.dimension) ?? [];
    list.push(item);
    grouped.set(item.dimension, list);
  }

  // 3. Build ThemeGroups with counts + suggested actions
  const groups: ThemeGroup[] = [];
  for (const [dim, items] of grouped) {
    // Sort: flags first, then wins
    items.sort((a, b) => {
      if (a.type !== b.type) return a.type === "flag" ? -1 : 1;
      return 0;
    });

    const flagCount = items.filter((i) => i.type === "flag").length;
    const winCount = items.filter((i) => i.type === "win").length;
    const label = dimLabel(dim);

    const suggestedAction = generateAction(label, items, flagCount, winCount);

    groups.push({ dimension: dim, label, items, flagCount, winCount, suggestedAction });
  }

  // 4. Sort groups: most flags first (most actionable), then by dimension order
  groups.sort((a, b) => {
    // Themes with flags come before themes without
    if (a.flagCount > 0 && b.flagCount === 0) return -1;
    if (a.flagCount === 0 && b.flagCount > 0) return 1;
    // Within same flag presence, sort by flag count desc
    if (a.flagCount !== b.flagCount) return b.flagCount - a.flagCount;
    // Fallback to configured order
    const orderA = DIMENSION_DISPLAY[a.dimension]?.order ?? 50;
    const orderB = DIMENSION_DISPLAY[b.dimension]?.order ?? 50;
    return orderA - orderB;
  });

  return groups;
}

function generateAction(
  label: string,
  items: FlatHeadline[],
  flagCount: number,
  winCount: number,
): string {
  const flagSegments = [...new Set(items.filter((i) => i.type === "flag").flatMap((i) => i.segments))];
  const winSegments = [...new Set(items.filter((i) => i.type === "win").flatMap((i) => i.segments))];

  // Extract just bucket names (strip axis label)
  const flagBuckets = [...new Set(flagSegments.map((s) => s.replace(/\s*\(.*\)$/, "")))];
  const winBuckets = [...new Set(winSegments.map((s) => s.replace(/\s*\(.*\)$/, "")))];

  if (flagCount > 0 && winCount === 0) {
    // All negative
    if (flagBuckets.length <= 2) {
      return `Prioritize ${label.toLowerCase()} improvements for ${flagBuckets.join(" and ")} dealers.`;
    }
    return `${label} is a concern across multiple segments — consider a dedicated improvement initiative.`;
  }

  if (flagCount === 0 && winCount > 0) {
    // All positive
    return `${label} is a competitive strength — feature it in sales conversations and marketing.`;
  }

  if (flagCount > winCount) {
    // Mostly negative
    if (flagBuckets.length <= 2) {
      return `Address ${label.toLowerCase()} concerns raised by ${flagBuckets.join(" and ")} — your wins here show the potential.`;
    }
    return `${label} needs attention across segments. Use what's working for ${winBuckets.slice(0, 2).join(" and ")} as a model.`;
  }

  if (winCount > flagCount) {
    // Mostly positive with some negatives
    const overlapBuckets = flagBuckets.filter((b) => winBuckets.includes(b));
    if (overlapBuckets.length > 0) {
      return `${label} is generally strong, but address specific complaints from ${flagBuckets.join(" and ")} to close the gap.`;
    }
    return `Leverage your ${label.toLowerCase()} wins — a few segments still flag concerns worth investigating.`;
  }

  // Even split
  return `${label} gets mixed reactions — investigate what's different between positive and negative experiences.`;
}

// ─── Risk Summary ────────────────────────────────────────────

function RiskSummary({ axes }: { axes: Record<SegmentAxis, SegmentBucket[]> }) {
  let atRisk = 0;
  let mixed = 0;
  let strong = 0;

  for (const axis of AXIS_ORDER) {
    for (const b of axes[axis]) {
      if (b.positive_pct < 50) atRisk++;
      else if (b.positive_pct < 70) mixed++;
      else strong++;
    }
  }

  return (
    <div className="flex items-center gap-4 text-sm">
      {atRisk > 0 && (
        <span className="flex items-center gap-1.5 text-red-700 font-medium">
          <ShieldAlert className="h-4 w-4" />
          {atRisk} at risk
        </span>
      )}
      {mixed > 0 && (
        <span className="flex items-center gap-1.5 text-amber-600 font-medium">
          <ShieldMinus className="h-4 w-4" />
          {mixed} mixed
        </span>
      )}
      {strong > 0 && (
        <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
          <ShieldCheck className="h-4 w-4" />
          {strong} strong
        </span>
      )}
    </div>
  );
}

// ─── Theme Card ──────────────────────────────────────────────

function ThemeCard({ group }: { group: ThemeGroup }) {
  const hasFlags = group.flagCount > 0;
  const hasWins = group.winCount > 0;

  const headerColor = hasFlags
    ? group.flagCount > group.winCount
      ? "text-red-700"
      : "text-amber-700"
    : "text-emerald-700";

  return (
    <div className="rounded-xl border border-border/50 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <h3 className={`text-[15px] font-semibold ${headerColor}`}>{group.label}</h3>
          <div className="flex items-center gap-2.5 text-[12px]">
            {hasFlags && (
              <span className="flex items-center gap-1 text-red-600 font-medium">
                <ThumbsDown className="h-3 w-3" />
                {group.flagCount}
              </span>
            )}
            {hasWins && (
              <span className="flex items-center gap-1 text-emerald-600 font-medium">
                <ThumbsUp className="h-3 w-3" />
                {group.winCount}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Headlines */}
      <div className="px-5 pb-3 space-y-1.5">
        {group.items.map((item, i) => (
          <div key={i} className="flex items-start gap-2 py-1">
            <span
              className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                item.type === "flag" ? "bg-red-400" : "bg-emerald-400"
              }`}
            />
            <div className="min-w-0 flex-1">
              <span className="text-[13px] text-slate-700 leading-snug">
                {item.headline}
              </span>
              {item.segments.length > 0 && (
                <span className="ml-1.5 text-[11px] text-slate-400">
                  — {item.segments.map((s) => s.replace(/\s*\(.*\)$/, "")).join(", ")}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Suggested Action */}
      <div className="border-t border-border/30 bg-slate-50/80 px-5 py-3">
        <div className="flex items-start gap-2">
          <Lightbulb className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-[12px] text-slate-600 leading-snug">
            {group.suggestedAction}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────

export function DashboardSegments({ vendorName }: DashboardSegmentsProps) {
  const { data: intel, isLoading, isError } = useVendorSegmentIntel(vendorName);

  const themeGroups = useMemo(() => {
    if (!intel) return [];
    return buildThemeGroups(intel.axes);
  }, [intel]);

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
        <p className="text-sm text-red-700">
          Failed to load segment data. Please try refreshing.
        </p>
      </div>
    );
  }

  const hasAnyBuckets = AXIS_ORDER.some((a) => intel.axes[a].length > 0);

  if (intel.total_attributed < 3 || !hasAnyBuckets) {
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Audience Segments</h1>
        <p className="mt-1 text-sm text-slate-500 mb-3">
          Based on {intel.total_attributed} attributed dealer mention{intel.total_attributed !== 1 ? "s" : ""}
        </p>
        <RiskSummary axes={intel.axes} />
      </div>

      {/* Theme Groups */}
      <div className="grid gap-4 md:grid-cols-2">
        {themeGroups.map((group) => (
          <ThemeCard key={group.dimension} group={group} />
        ))}
      </div>
    </div>
  );
}
