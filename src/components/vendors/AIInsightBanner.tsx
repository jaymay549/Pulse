import React, { useState, useEffect } from "react";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Lock,
  Loader2,
} from "lucide-react";
import { VendorEntry } from "@/hooks/useVendorReviews";
import { cn } from "@/lib/utils";
import { fetchVendorInsight } from "@/hooks/useSupabaseVendorData";
import { motion, AnimatePresence } from "framer-motion";

interface AIInsightBannerProps {
  data: VendorEntry[];
  selectedCategory?: string | null;
  searchQuery?: string;
  selectedVendor?: string | null;
  fetchWithAuth?: (url: string, options?: RequestInit) => Promise<Response>;
  fallbackInsight?: InsightData | null;
  className?: string;
  onUpgradeClick?: () => void;
}

interface InsightData {
  headline: string;
  sentiment: "positive" | "negative" | "mixed" | "neutral";
  warningPercent?: number;
  topCategory?: string;
  topCategoryCount?: number;
  topVendor?: string;
  topVendorCount?: number;
  stats: {
    total: number;
    positive: number;
    warnings: number;
  };
}

export const AIInsightBanner: React.FC<AIInsightBannerProps> = ({
  selectedCategory,
  searchQuery,
  selectedVendor,
  fallbackInsight,
  className,
  onUpgradeClick,
}) => {
  const [insight, setInsight] = useState<InsightData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    // Only fetch when we have a vendor name (either selected or typed)
    const hasVendorQuery =
      selectedVendor || (searchQuery && searchQuery.trim().length > 0);
    const hasCategoryFilter = selectedCategory && selectedCategory !== "all";

    // Skip if no meaningful filter is applied
    if (!hasVendorQuery && !hasCategoryFilter) {
      setInsight(null);
      setIsLoading(false);
      setIsLocked(false);
      return;
    }

    const loadInsight = async () => {
      setIsLocked(false);
      setIsLoading(true);

      try {
        // Prioritize selectedVendor over searchQuery for vendor scoping
        const vendorName =
          selectedVendor ||
          (searchQuery && searchQuery.trim().length > 0 ? searchQuery : null);

        const insightData = await fetchVendorInsight({
          vendorName: vendorName || undefined,
          category: !vendorName ? selectedCategory : undefined,
        });

        if (insightData) {
          setInsight(insightData);
        } else if (fallbackInsight) {
          setInsight(fallbackInsight);
        } else {
          setInsight(null);
        }
      } catch (err) {
        console.error("Failed to fetch AI insight:", err);
        setInsight(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadInsight();
  }, [selectedCategory, searchQuery, selectedVendor]);

  // Hide AI Intelligence banner when search query is present (but show if vendor is selected)
  if (searchQuery && searchQuery.trim().length > 0 && !selectedVendor) {
    return null;
  }

  if (!isLoading && !insight && !isLocked) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative overflow-hidden rounded-xl border bg-gradient-to-r from-primary/5 via-card to-yellow-500/5 transition-colors duration-500",
        "border-border/50 shadow-sm",
        className,
      )}
    >
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* AI Icon */}
          <div className="flex-shrink-0 p-2.5 rounded-xl bg-primary/10 relative">
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div
                  key="loader"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  <Loader2 className="h-5 w-5 text-primary animate-spin" />
                </motion.div>
              ) : (
                <motion.div
                  key="sparkle"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  <Sparkles className="h-5 w-5 text-primary" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Pulsing ring during loading */}
            {isLoading && (
              <span className="absolute inset-0 rounded-xl border-2 border-primary/20 animate-ping" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                CDG Intelligence
              </span>
              <div className="h-1 w-1 rounded-full bg-border" />
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                {isLoading ? "Analyzing conversations" : "Real-time Insight"}
              </span>
            </div>

            <div className="relative min-h-[44px] flex flex-col justify-center">
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <motion.div
                    key="loading-state"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="space-y-2.5 py-1"
                  >
                    <div className="h-3.5 bg-primary/10 animate-pulse rounded-full w-4/5" />
                    <div className="h-3.5 bg-primary/5 animate-pulse rounded-full w-2/3" />
                  </motion.div>
                ) : isLocked ? (
                  <motion.div
                    key="locked-state"
                    initial={{ opacity: 0, filter: "blur(4px)" }}
                    animate={{ opacity: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0, filter: "blur(4px)" }}
                    className="flex flex-col items-start gap-2.5"
                  >
                    <p className="text-sm text-foreground/80 font-medium flex items-center gap-2">
                      <Lock className="h-3.5 w-3.5 text-yellow-600" />
                      <span>
                        See what dealers really think about{" "}
                        <strong>
                          {selectedVendor || searchQuery || "this category"}
                        </strong>{" "}
                        — unlock with Pro.
                      </span>
                    </p>
                    <button
                      onClick={onUpgradeClick}
                      className="text-xs font-bold text-yellow-600 hover:text-yellow-700 flex items-center gap-1 group"
                    >
                      Unlock with Pro Access
                      <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  </motion.div>
                ) : insight ? (
                  <motion.div
                    key="insight-state"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                  >
                    <p className="text-[15px] text-foreground leading-relaxed font-medium tracking-tight">
                      {insight.sentiment === "negative" ? (
                        <TrendingDown className="inline h-4 w-4 text-red-500 mr-2 mb-0.5" />
                      ) : insight.sentiment === "positive" ? (
                        <TrendingUp className="inline h-4 w-4 text-green-500 mr-2 mb-0.5" />
                      ) : null}
                      {insight.headline}
                    </p>

                    {/* Quick Stats */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className="flex items-center gap-4 mt-3.5 text-[11px] font-semibold tracking-wide"
                    >
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <span className="text-foreground">
                          {insight.stats.total}
                        </span>{" "}
                        Total Excerpts
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-green-600/90 flex items-center gap-1">
                          <div className="h-1 w-1 rounded-full bg-green-500" />
                          {insight.stats.positive} Positive
                        </span>
                        <span className="text-red-500/90 flex items-center gap-1">
                          <div className="h-1 w-1 rounded-full bg-red-500" />
                          {insight.stats.warnings} Concerns
                        </span>
                      </div>
                    </motion.div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Decorative pulse glow */}
      {!isLoading && insight && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={cn(
            "absolute top-0 right-0 w-32 h-full pointer-events-none",
            insight.sentiment === "positive"
              ? "bg-gradient-to-l from-green-500/5 to-transparent"
              : insight.sentiment === "negative"
                ? "bg-gradient-to-l from-red-500/5 to-transparent"
                : "bg-gradient-to-l from-yellow-500/5 to-transparent",
          )}
        />
      )}

      {/* Mesh gradient effect for loading */}
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 pointer-events-none bg-gradient-to-r from-transparent via-primary/5 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"
        />
      )}

      {/* AI Disclaimer */}
      <p className="absolute bottom-1 right-3 text-[9px] text-muted-foreground/60 font-normal pointer-events-none">
        AI can make mistakes
      </p>
    </motion.div>
  );
};

export default AIInsightBanner;
