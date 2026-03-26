import { useState, useCallback, useRef } from "react";
import { useClerkSupabase } from "@/hooks/useClerkSupabase";
import type { SalesOpportunitySignal, SalesSynopsis } from "@/types/sales-targets";

const SYNOPSIS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-sales-synopsis`;

export function useSalesSynopsis() {
  const supabase = useClerkSupabase();
  const [cache, setCache] = useState<Record<string, SalesSynopsis>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const abortControllers = useRef<Record<string, AbortController>>({});

  const generate = useCallback(
    async (signal: SalesOpportunitySignal) => {
      const key = signal.vendor_name;

      if (cache[key]) return;
      if (loading[key]) return;

      setLoading((prev) => ({ ...prev, [key]: true }));
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });

      try {
        const { data: mentions } = await supabase
          .from("vendor_mentions")
          .select("type, headline, quote, dimension")
          .ilike("vendor_name", signal.vendor_name)
          .order("created_at", { ascending: false })
          .limit(10);

        const controller = new AbortController();
        abortControllers.current[key] = controller;

        const response = await fetch(SYNOPSIS_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            signal,
            mentions: mentions || [],
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Synopsis generation failed (${response.status})`);
        }

        const synopsis: SalesSynopsis = await response.json();
        setCache((prev) => ({ ...prev, [key]: synopsis }));
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setErrors((prev) => ({
          ...prev,
          [key]: err instanceof Error ? err.message : "Failed to generate synopsis",
        }));
      } finally {
        setLoading((prev) => ({ ...prev, [key]: false }));
        delete abortControllers.current[key];
      }
    },
    [cache, loading, supabase]
  );

  const retry = useCallback(
    (signal: SalesOpportunitySignal) => {
      const key = signal.vendor_name;
      setCache((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      generate(signal);
    },
    [generate]
  );

  return { cache, loading, errors, generate, retry };
}
