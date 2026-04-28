import { createContext, useContext, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useClerkSupabase } from "@/hooks/useClerkSupabase";

// ── Types ─────────────────────────────────────────────────────

export interface ActiveProductLine {
  slug: string;
  name: string;
  tier: string;
}

interface ActiveProductLineContextValue {
  activeProductLine: ActiveProductLine | null;
  setActiveProductLine: (pl: ActiveProductLine) => void;
  subscriptions: ActiveProductLine[];
  isLoading: boolean;
}

// ── Context ───────────────────────────────────────────────────

const ActiveProductLineContext = createContext<ActiveProductLineContextValue>({
  activeProductLine: null,
  setActiveProductLine: () => {},
  subscriptions: [],
  isLoading: false,
});

// ── Provider ──────────────────────────────────────────────────

interface ActiveProductLineProviderProps {
  children: React.ReactNode;
  /** Whether the session is a vendor magic-link session (isVendorAuth). */
  isVendorAuth: boolean;
  /** Supabase auth user ID for the vendor session, if available. */
  vendorUserId?: string | null;
}

export function ActiveProductLineProvider({
  children,
  isVendorAuth,
  vendorUserId,
}: ActiveProductLineProviderProps) {
  const supabase = useClerkSupabase();
  const [activeProductLine, setActiveProductLine] = useState<ActiveProductLine | null>(null);

  const { data: subscriptions = [], isLoading } = useQuery<ActiveProductLine[]>({
    queryKey: ["vendor-subscribed-slugs", vendorUserId ?? null],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "vendor_subscribed_slugs" as never,
        {} as never
      );
      if (error) {
        console.error("[useActiveProductLine] vendor_subscribed_slugs error:", error);
        return [];
      }
      return ((data as any[]) ?? []).map((row: any) => ({
        slug: row.slug as string,
        name: row.name as string,
        tier: row.tier as string,
      }));
    },
    // Only fetch for vendor magic-link sessions where we have a user ID
    enabled: isVendorAuth && !!vendorUserId,
    staleTime: 5 * 60 * 1000,
  });

  // Auto-select first subscription on initial load (D-09)
  useEffect(() => {
    if (subscriptions.length > 0 && activeProductLine === null) {
      setActiveProductLine(subscriptions[0]);
    }
  }, [subscriptions, activeProductLine]);

  return (
    <ActiveProductLineContext.Provider
      value={{ activeProductLine, setActiveProductLine, subscriptions, isLoading }}
    >
      {children}
    </ActiveProductLineContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────

/**
 * Returns the currently selected product line from context.
 * Must be called inside an <ActiveProductLineProvider> boundary.
 */
export function useActiveProductLine(): ActiveProductLineContextValue {
  return useContext(ActiveProductLineContext);
}
