interface Tier2CapabilityCardProps {
  /** Optional callback fired when the user clicks the CTA. */
  onCtaClick?: () => void;
}

export function Tier2CapabilityCard({ onCtaClick }: Tier2CapabilityCardProps = {}) {
  return (
    <div
      className="flex flex-col gap-1.5 rounded-xl border p-5"
      style={{
        borderColor: "rgba(224,161,6,0.35)",
        background: "linear-gradient(180deg, #FFFBEB 0%, #fff 100%)",
      }}
    >
      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-amber-600">
        ◆ Available in Tier 2
      </span>
      <h4 className="mt-1 text-sm font-extrabold tracking-tight text-slate-900">
        Diagnostic mode: see why you rank where you do.
      </h4>
      <p className="text-[13px] leading-snug text-slate-600">
        Tier 2 expands every score in this table into the underlying evidence:
      </p>
      <ul className="mt-1 flex flex-col gap-1 text-xs text-slate-700">
        <CapabilityBullet>The dealer quotes driving each dimension score</CapabilityBullet>
        <CapabilityBullet>Specific feature gaps mapped to that dimension</CapabilityBullet>
        <CapabilityBullet>Competitor moves that shifted your rank in the last 90 days</CapabilityBullet>
      </ul>
      <button
        type="button"
        onClick={onCtaClick}
        className="mt-2.5 self-start rounded-lg border border-slate-300 bg-transparent px-3 py-1.5 font-sans text-xs font-semibold text-slate-900 transition-colors hover:border-slate-900 hover:bg-slate-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        Talk to your CSM about Tier 2 →
      </button>
      <span className="mt-1.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-slate-400">
        Already on Tier 2? Click any row above.
      </span>
    </div>
  );
}

function CapabilityBullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-baseline gap-2">
      <span className="mt-1.5 inline-block h-1 w-1 flex-shrink-0 rounded-full bg-amber-600" />
      <span>{children}</span>
    </li>
  );
}
