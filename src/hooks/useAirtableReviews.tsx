import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useClerkAuth } from '@/hooks/useClerkAuth';

export type WinType = 'positive' | 'warning';

export interface VendorEntry {
  id: number;
  airtableId?: string;
  title: string;
  quote: string;
  explanation: string;
  member?: string;
  type: WinType;
  category: string;
  vendorName?: string;
}

export type UserTier = 'anonymous' | 'free' | 'pro' | 'executive';

interface UseAirtableReviewsResult {
  reviews: VendorEntry[];
  isLoading: boolean;
  error: string | null;
  userTier: UserTier;
  isAuthenticated: boolean;
  refetch: () => Promise<void>;
}

export function useAirtableReviews(): UseAirtableReviewsResult {
  const [reviews, setReviews] = useState<VendorEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { isAuthenticated, tier, isLoading: authLoading } = useClerkAuth();

  // Map Clerk tier to UserTier
  const userTier: UserTier = !isAuthenticated 
    ? 'anonymous' 
    : tier === 'executive' 
      ? 'executive' 
      : tier === 'pro' 
        ? 'pro' 
        : 'free';

  const fetchReviewsData = async () => {
    // Fetch reviews from Airtable via backend function
    const { data, error: fnError } = await supabase.functions.invoke('fetch-airtable-reviews');

    if (fnError) {
      console.error('Error fetching reviews:', fnError);
      setError('Failed to load reviews');
      return;
    }

    if (data?.reviews) {
      setReviews(data.reviews);
      console.log(`Loaded ${data.reviews.length} reviews from Airtable`);
    }
  };

  const fetchAll = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await fetchReviewsData();
    } catch (err) {
      console.error('Error in useAirtableReviews:', err);
      setError('Failed to load reviews');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchAll();
    }
  }, [authLoading, isAuthenticated]);

  return {
    reviews,
    isLoading: isLoading || authLoading,
    error,
    userTier,
    isAuthenticated,
    refetch: fetchAll,
  };
}

// Helper to determine access level based on tier
export function getAccessLevel(userTier: UserTier): {
  freeReviewCount: number;
  showVendorNames: boolean;
  unlimitedAccess: boolean;
} {
  switch (userTier) {
    case 'pro':
    case 'executive':
      return {
        freeReviewCount: Infinity,
        showVendorNames: true,
        unlimitedAccess: true,
      };
    case 'free':
      // Community tier: 3 full reviews visible, rest redacted
      return {
        freeReviewCount: 3,
        showVendorNames: true,
        unlimitedAccess: false,
      };
    case 'anonymous':
    default:
      // Non-members: 3 redacted reviews visible after search, all blurred
      return {
        freeReviewCount: 3,
        showVendorNames: false,
        unlimitedAccess: false,
      };
  }
}
