import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface VendorReview {
  id: number;
  vendor_name: string;
  title: string;
  quote: string;
  explanation: string | null;
  member: string | null;
  type: "positive" | "warning";
  category: string;
  created_at: string;
  updated_at: string;
}

// Transform to match existing VendorEntry interface for backward compatibility
export interface VendorEntry {
  id: number | string;
  vendorName?: string; // Optional - backend doesn't serve it when hidden
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

export function useVendorReviews(): UseVendorReviewsResult {
  const [reviews, setReviews] = useState<VendorEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReviews = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("vendor_reviews")
        .select("*")
        .order("id", { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      // Transform to VendorEntry format for backward compatibility
      const transformedReviews: VendorEntry[] = (data || []).map((review: VendorReview) => ({
        id: review.id,
        vendorName: review.vendor_name,
        title: review.title,
        quote: review.quote,
        explanation: review.explanation || "",
        member: review.member || undefined,
        type: review.type,
        category: review.category,
        createdAt: review.created_at,
      }));

      setReviews(transformedReviews);
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