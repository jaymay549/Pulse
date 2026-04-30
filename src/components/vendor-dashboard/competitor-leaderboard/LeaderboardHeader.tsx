import { Trophy } from "lucide-react";
import type { LeaderboardSegment } from "./types";

interface LeaderboardHeaderProps {
  segment: LeaderboardSegment;
}

export function LeaderboardHeader({ segment }: LeaderboardHeaderProps) {
  const includedCategories = segment.included_categories ?? [];
  const segmentLabel =
    segment.origin === "override"
      ? "your curated competitor set"
      : segment.widened_to
      ? `the broader ${segment.widened_to} category`
      : segment.category ?? "your segment";

  return (
    <div>
      <div className="flex items-center gap-2">
        <Trophy className="h-5 w-5 text-slate-400" />
        <h2 className="text-lg font-medium text-slate-900">Competitor Leaderboard</h2>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Where you rank in {segmentLabel}, across every metric. 90-day window, weighted composite.
      </p>
      {includedCategories.length > 0 && (
        <p className="mt-1 text-xs text-slate-400">
          Categories compared: {includedCategories.map(formatCategory).join(", ")}
        </p>
      )}
    </div>
  );
}

function formatCategory(category: string): string {
  return category.replace(/-/g, " ");
}
