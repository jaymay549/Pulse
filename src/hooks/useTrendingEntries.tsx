import { useState, useMemo, useCallback } from "react";

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

// Track which entries have been viewed in this session to prevent duplicate increments
const viewedThisSession = new Set<number>();

// In-memory stats storage (no database)
const inMemoryStats: ViewStats = {};

export const useTrendingEntries = (allEntries: EntryInput[]) => {
  const [viewStats, setViewStats] = useState<ViewStats>(inMemoryStats);
  const [isLoading] = useState(false);

  // Helper to convert id to number
  const toNumericId = (entryId: number | string): number | null => {
    const numericId = typeof entryId === 'string' ? parseInt(entryId, 10) : entryId;
    return isNaN(numericId) ? null : numericId;
  };

  // Track a view - in-memory only
  const trackView = useCallback((entryId: number | string) => {
    const numericId = toNumericId(entryId);
    if (numericId === null) return;
    
    // Prevent duplicate views in same session
    if (viewedThisSession.has(numericId)) {
      return;
    }
    viewedThisSession.add(numericId);

    setViewStats(prev => {
      const updated = {
        ...prev,
        [numericId]: {
          views: (prev[numericId]?.views || 0) + 1,
          shares: prev[numericId]?.shares || 0,
        },
      };
      // Update in-memory storage
      Object.assign(inMemoryStats, updated);
      return updated;
    });
  }, []);

  // Track a share - in-memory only
  const trackShare = useCallback((entryId: number | string) => {
    const numericId = toNumericId(entryId);
    if (numericId === null) return;

    setViewStats(prev => {
      const updated = {
        ...prev,
        [numericId]: {
          views: prev[numericId]?.views || 0,
          shares: (prev[numericId]?.shares || 0) + 1,
        },
      };
      // Update in-memory storage
      Object.assign(inMemoryStats, updated);
      return updated;
    });
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
