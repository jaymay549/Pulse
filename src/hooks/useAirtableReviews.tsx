import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
  const [userTier, setUserTier] = useState<UserTier>('anonymous');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const fetchAuthAndTier = async (opts?: { silent?: boolean }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        setIsAuthenticated(true);

        const { data: profile } = await supabase
          .from('profiles')
          .select('tier')
          .eq('id', user.id)
          .maybeSingle();

        setUserTier((profile?.tier as UserTier) || 'free');
      } else {
        setIsAuthenticated(false);
        setUserTier('anonymous');
      }
    } catch (err) {
      // Tier lookup should never hard-break the page
      console.error('Error fetching auth/tier:', err);
      if (!opts?.silent) setError('Failed to load membership');
    }
  };

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
      await fetchAuthAndTier();
      await fetchReviewsData();
    } catch (err) {
      console.error('Error in useAirtableReviews:', err);
      setError('Failed to load reviews');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchAll();
    });

    // Refresh tier when the tab becomes active again (covers tier changes made while logged in)
    const handleFocus = () => {
      fetchAuthAndTier({ silent: true });
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    // Lightweight periodic refresh for long-lived sessions
    const intervalId = window.setInterval(() => {
      fetchAuthAndTier({ silent: true });
    }, 30_000);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
      window.clearInterval(intervalId);
    };
  }, []);

  return {
    reviews,
    isLoading,
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
