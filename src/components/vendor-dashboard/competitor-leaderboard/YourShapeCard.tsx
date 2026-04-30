import type { LeaderboardPayload, LeaderboardVendor } from "./types";

interface YourShapeCardProps {
  payload: LeaderboardPayload;
}

type Dimension = "product_stability" | "customer_experience" | "value_perception";

const DIMENSION_LABEL: Record<Dimension, string> = {
  product_stability:    "Product Stability",
  customer_experience:  "Customer Experience",
  value_perception:     "Value Perception",
};

export function YourShapeCard({ payload }: YourShapeCardProps) {
  const self = payload.vendors.find((v) => v.is_self);
  if (!self) return null;

  const ranks = computeDimensionRanks(payload.vendors);
  const median = payload.segment.median;

  const sorted: Array<{ key: Dimension; rank: number; score: number | null }> = (
    ["product_stability", "customer_experience", "value_perception"] as Dimension[]
  ).map((k) => ({ key: k, rank: ranks[k][self.vendor_name] ?? Infinity, score: scoreFor(self, k) }));

  sorted.sort((a, b) => a.rank - b.rank);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">
          Your shape
        </h3>
      </div>
      <p className="text-sm font-semibold text-slate-900 leading-snug">
        {best.score !== null && worst.score !== null
          ? `You lead in ${DIMENSION_LABEL[best.key]}, but lag in ${DIMENSION_LABEL[worst.key]}.`
          : "Building your shape."}
      </p>
      <p className="mt-2 text-xs text-slate-600 leading-relaxed">
        {renderLines({ self, best, worst, median })}
      </p>
    </div>
  );
}

function scoreFor(v: LeaderboardVendor, k: Dimension): number | null {
  if (k === "product_stability") return v.product_stability_score;
  if (k === "customer_experience") return v.customer_experience_score;
  return v.value_perception_score;
}

function computeDimensionRanks(vendors: LeaderboardVendor[]): Record<Dimension, Record<string, number>> {
  const acc: Record<Dimension, Record<string, number>> = {
    product_stability: {}, customer_experience: {}, value_perception: {},
  };
  (Object.keys(acc) as Dimension[]).forEach((k) => {
    const sorted = [...vendors]
      .filter((v) => scoreFor(v, k) !== null)
      .sort((a, b) => (scoreFor(b, k) ?? 0) - (scoreFor(a, k) ?? 0));
    sorted.forEach((v, i) => { acc[k][v.vendor_name] = i + 1; });
  });
  return acc;
}

function renderLines({
  self, best, worst, median,
}: {
  self: LeaderboardVendor;
  best:  { key: Dimension; rank: number; score: number | null };
  worst: { key: Dimension; rank: number; score: number | null };
  median: { product_stability: number | null; customer_experience: number | null; value_perception: number | null; health_score: number | null };
}) {
  const bestMedian  = medianFor(median, best.key);
  const worstMedian = medianFor(median, worst.key);
  const delta90     = self.rank_delta_90d;

  return (
    <>
      Rank <strong className="font-bold text-slate-900">#{best.rank} in {DIMENSION_LABEL[best.key]}</strong>{" "}
      with a score of <span className="font-bold text-emerald-600">{best.score}</span>
      {bestMedian !== null && `, well above the segment median of ${bestMedian}`}.
      <br />
      Rank <strong className="font-bold text-slate-900">#{worst.rank} in {DIMENSION_LABEL[worst.key]}</strong>{" "}
      with <span className="font-bold text-red-500">{worst.score}</span>
      {worstMedian !== null && `, below the median of ${worstMedian}`}. This is what is holding your composite to #{self.rank}.
      {delta90 !== null && (
        <>
          <br />
          Pulse momentum:{" "}
          <span className={delta90 > 0 ? "font-bold text-emerald-600" : "font-bold text-red-500"}>
            {delta90 > 0 ? `+${delta90}` : delta90}
          </span>{" "}
          over last 90 days.
        </>
      )}
    </>
  );
}

function medianFor(
  median: { product_stability: number | null; customer_experience: number | null; value_perception: number | null; health_score: number | null },
  key: Dimension,
): number | null {
  if (key === "product_stability") return median.product_stability;
  if (key === "customer_experience") return median.customer_experience;
  return median.value_perception;
}
