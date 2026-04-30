import { Sparkles } from "lucide-react";

interface Tier2CapabilityCardProps {
  /** Optional callback fired when the user clicks the CTA. */
  onCtaClick?: () => void;
}

export function Tier2CapabilityCard({ onCtaClick }: Tier2CapabilityCardProps = {}) {
  return (
    <div className="rounded-xl border border-yellow-400 bg-white p-5">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-amber-500" />
        <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">
          Available in Tier 2
        </h3>
      </div>

      <p className="text-sm font-semibold text-slate-900 leading-snug">
        Diagnostic mode: see why you rank where you do.
      </p>
      <p className="mt-1 text-xs text-slate-600 leading-relaxed">
        Tier 2 expands every score in this table into the underlying evidence.
      </p>

      <ul className="mt-3 space-y-1.5 text-xs text-slate-600">
        <CapabilityBullet>The dealer quotes driving each dimension score</CapabilityBullet>
        <CapabilityBullet>Specific feature gaps mapped to that dimension</CapabilityBullet>
        <CapabilityBullet>Competitor moves that shifted your rank in the last 90 days</CapabilityBullet>
      </ul>

      <button
        type="button"
        onClick={onCtaClick}
        className="mt-4 inline-flex items-center rounded-lg border border-slate-900 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-yellow-400 transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        Talk to your CSM about Tier 2 →
      </button>

      <p className="mt-3 text-[11px] text-slate-400">
        Already on Tier 2? Click any row above.
      </p>
    </div>
  );
}

function CapabilityBullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-baseline gap-2">
      <span className="mt-1.5 inline-block h-1 w-1 flex-shrink-0 rounded-full bg-amber-500" />
      <span>{children}</span>
    </li>
  );
}
