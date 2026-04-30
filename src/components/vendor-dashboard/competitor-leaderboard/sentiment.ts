// CAR-19: sentiment color tokens shared across leaderboard cells.
// Mirrors DESIGN.md sentiment scale: ≥70 emerald, 50–69 amber, <50 red.

export type SentimentTier = "hi" | "mid" | "lo" | "muted";

export function sentimentTier(score: number | null): SentimentTier {
  if (score === null) return "muted";
  if (score >= 70) return "hi";
  if (score >= 50) return "mid";
  return "lo";
}

export function sentimentTextClass(score: number | null): string {
  switch (sentimentTier(score)) {
    case "hi": return "text-emerald-600";
    case "mid": return "text-amber-600";
    case "lo": return "text-red-500";
    default: return "text-slate-400";
  }
}
