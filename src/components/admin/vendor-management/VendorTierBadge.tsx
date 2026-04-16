const TIER_STYLES: Record<string, string> = {
  unverified: "bg-zinc-700 text-zinc-300",
  tier_1: "bg-green-900/50 text-green-300 border border-green-700/50",
  tier_2: "bg-purple-900/50 text-purple-300 border border-purple-700/50",
};

const TIER_LABELS: Record<string, string> = {
  unverified: "Unverified",
  tier_1: "T1",
  tier_2: "T2",
};

export function VendorTierBadge({ tier }: { tier: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${TIER_STYLES[tier] ?? TIER_STYLES.unverified}`}
    >
      {TIER_LABELS[tier] ?? "Unknown"}
    </span>
  );
}
