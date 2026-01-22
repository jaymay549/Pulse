import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";


interface ViewStats {
  [entryId: number]: {
    views: number;
    shares: number;
  };
}

interface EntryInput {
  id: number | string;
  title: string;
  quote: string;
  type: "positive" | "warning";
  category: string;
}

const TRENDING_COUNT = 5;
const DEBOUNCE_MS = 1000; // Debounce view tracking to prevent spam

// Track which entries have been viewed in this session to prevent duplicate increments
const viewedThisSession = new Set<number>();

export const useTrendingEntries = (allEntries: EntryInput[]) => {
  const [viewStats, setViewStats] = useState<ViewStats>({});
  const [isLoading, setIsLoading] = useState(true);

  // Fetch stats from database
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data, error } = await supabase
          .from('vendor_entry_stats')
          .select('entry_id, views, shares');
        
        if (error) {
          console.error('Error fetching vendor stats:', error);
          return;
        }

        const stats: ViewStats = {};
        data?.forEach(row => {
          stats[row.entry_id] = {
            views: row.views,
            shares: row.shares,
          };
        });
        setViewStats(stats);
      } catch (err) {
        console.error('Error fetching stats:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  // Helper to convert id to number
  const toNumericId = (entryId: number | string): number | null => {
    const numericId = typeof entryId === 'string' ? parseInt(entryId, 10) : entryId;
    return isNaN(numericId) ? null : numericId;
  };

  // Track a view - increments in database
  const trackView = useCallback(async (entryId: number | string) => {
    const numericId = toNumericId(entryId);
    if (numericId === null) return;
    
    // Prevent duplicate views in same session
    if (viewedThisSession.has(numericId)) {
      return;
    }
    viewedThisSession.add(numericId);

    // Optimistic update
    setViewStats(prev => ({
      ...prev,
      [numericId]: {
        views: (prev[numericId]?.views || 0) + 1,
        shares: prev[numericId]?.shares || 0,
      },
    }));

    try {
      // Check if entry exists
      const { data: existing } = await supabase
        .from('vendor_entry_stats')
        .select('id, views')
        .eq('entry_id', numericId)
        .maybeSingle();

      if (existing) {
        // Update existing
        await supabase
          .from('vendor_entry_stats')
          .update({ views: existing.views + 1 })
          .eq('entry_id', numericId);
      } else {
        // Insert new
        await supabase
          .from('vendor_entry_stats')
          .insert({ entry_id: numericId, views: 1, shares: 0 });
      }
    } catch (err) {
      console.error('Error tracking view:', err);
    }
  }, []);

  // Track a share - increments in database
  const trackShare = useCallback(async (entryId: number | string) => {
    const numericId = toNumericId(entryId);
    if (numericId === null) return;

    // Optimistic update
    setViewStats(prev => ({
      ...prev,
      [numericId]: {
        views: prev[numericId]?.views || 0,
        shares: (prev[numericId]?.shares || 0) + 1,
      },
    }));

    try {
      // Check if entry exists
      const { data: existing } = await supabase
        .from('vendor_entry_stats')
        .select('id, shares')
        .eq('entry_id', numericId)
        .maybeSingle();

      if (existing) {
        // Update existing
        await supabase
          .from('vendor_entry_stats')
          .update({ shares: existing.shares + 1 })
          .eq('entry_id', numericId);
      } else {
        // Insert new
        await supabase
          .from('vendor_entry_stats')
          .insert({ entry_id: numericId, views: 0, shares: 1 });
      }
    } catch (err) {
      console.error('Error tracking share:', err);
    }
  }, []);

  // Calculate trending entries (weighted: shares count 3x more than views)
  const trendingEntries = useMemo(() => 
    allEntries
      .map(entry => {
        const numericId = toNumericId(entry.id);
        return {
          ...entry,
          views: numericId !== null ? (viewStats[numericId]?.views || 0) : 0,
          shares: numericId !== null ? (viewStats[numericId]?.shares || 0) : 0,
          score: numericId !== null 
            ? (viewStats[numericId]?.views || 0) + (viewStats[numericId]?.shares || 0) * 3 
            : 0,
        };
      })
      .filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, TRENDING_COUNT),
    [allEntries, viewStats]
  );

  return {
    trendingEntries,
    trackView,
    trackShare,
    viewStats,
    isLoading,
  };
};

export default useTrendingEntries;
