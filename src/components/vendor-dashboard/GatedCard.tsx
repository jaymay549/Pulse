import { createContext, useContext } from "react";
import { Lock } from "lucide-react";
import { useTierConfigReadonly, getVisibility } from "@/hooks/useTierConfig";
import type { VendorTier } from "@/types/tier-config";

/** Context that provides the current vendor tier to GatedCard descendants */
const VendorTierContext = createContext<string | undefined>(undefined);

export const VendorTierProvider = VendorTierContext.Provider;

export function useVendorTier() {
  return useContext(VendorTierContext);
}

interface GatedCardProps {
  componentKey: string;
  children: React.ReactNode;
  /** Optional class to apply to the wrapper when gated */
  className?: string;
}

/**
 * Wraps a dashboard sub-component with tier-based visibility.
 *
 * - "full"   → renders children normally
 * - "gated"  → renders children with blurred content + lock overlay
 * - "hidden" → renders nothing
 *
 * Reads the vendor tier from VendorTierContext (provided by VendorDashboardPage).
 * When no tier is set (admin full-access mode), always renders as "full".
 */
export function GatedCard({ componentKey, children, className }: GatedCardProps) {
  const tier = useVendorTier();
  const { configs } = useTierConfigReadonly();

  // No tier = admin full access, show everything
  if (!tier) return <>{children}</>;

  const vis = getVisibility(configs, tier as VendorTier, componentKey);

  if (vis === "hidden") return null;

  if (vis === "gated") {
    return (
      <div className={`relative ${className ?? ""}`}>
        <div className="pointer-events-none select-none [&>*]:blur-[12px] [&>*]:opacity-50">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-2 px-5 py-2.5 bg-white/95 rounded-full shadow-md border border-slate-200">
            <Lock className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-semibold text-slate-700">Premium</span>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
