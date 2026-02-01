import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// Transform to match existing VendorEntry interface for backward compatibility
export interface VendorEntry {
  id: number | string;
  vendorName?: string;
  title: string;
  quote: string;
  explanation: string;
  member?: string;
  type: "positive" | "warning";
  category: string;
  createdAt?: string;
  isLocked?: boolean;
  views?: number;
  shares?: number;
}

interface UseVendorReviewsResult {
  reviews: VendorEntry[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for vendor reviews - fetches from Airtable via edge function
 * since database tables were removed.
 */
export function useVendorReviews(): UseVendorReviewsResult {
  const [reviews, setReviews] = useState<VendorEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReviews = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch from Airtable via edge function
      const { data, error: fnError } = await supabase.functions.invoke("fetch-airtable-reviews");

      if (fnError) {
        throw fnError;
      }

      if (data?.reviews) {
        setReviews(data.reviews);
      }
    } catch (err) {
      console.error("Error fetching vendor reviews:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch reviews");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  return {
    reviews,
    isLoading,
    error,
    refetch: fetchReviews,
  };
}
