import { useState } from "react";

// Transform to match existing VendorEntry interface for backward compatibility
export interface VendorEntry {
  id: number | string;
  vendorName?: string;
  rawVendorName?: string;
  title: string;
  quote: string;
  rawQuote?: string;
  displayMode?: "raw" | "rewritten_negative";
  qualityScore?: number | null;
  evidenceLevel?: "none" | "weak" | "moderate" | "strong" | null;
  isOpinionHeavy?: boolean | null;
  rewriteConfidence?: number | null;
  explanation: string;
  member?: string;
  type: "positive" | "warning" | "negative" | "neutral" | "mixed";
  category: string;
  conversationTime?: string;
  npsTier?: "promoter" | "passive" | "detractor" | null;
  sentimentScore?: number | null;
  isLocked?: boolean;
  views?: number;
  shares?: number;
  vendorResponse?: {
    responseText: string;
    respondedAt: string;
  } | null;
}

interface UseVendorReviewsResult {
  reviews: VendorEntry[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for vendor reviews - currently returns empty array.
 * Reviews functionality is disabled until a data source is configured.
 */
export function useVendorReviews(): UseVendorReviewsResult {
  const [reviews] = useState<VendorEntry[]>([]);
  const [isLoading] = useState(false);
  const [error] = useState<string | null>(null);

  const refetch = async () => {
    // No-op - no data source configured
  };

  return {
    reviews,
    isLoading,
    error,
    refetch,
  };
}
