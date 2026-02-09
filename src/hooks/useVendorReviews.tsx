import { useState } from "react";

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
  conversationTime?: string;
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
