import React from "react";
import { Lock, Crown, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface UpgradeTeaserProps {
  remainingCount: number;
  isAuthenticated: boolean;
  onUpgradeClick: () => void;
  className?: string;
}

export const UpgradeTeaser: React.FC<UpgradeTeaserProps> = ({
  remainingCount,
  isAuthenticated,
  onUpgradeClick,
  className,
}) => {
  const handleClick = () => {
    if (isAuthenticated) {
      onUpgradeClick();
    } else {
      const tiersSection = document.getElementById('tiers-section');
      if (tiersSection) {
        const offset = 100;
        const elementPosition = tiersSection.getBoundingClientRect().top + window.pageYOffset;
        window.scrollTo({ top: elementPosition - offset, behavior: 'smooth' });
      }
    }
  };

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-lg border-2 border-dashed border-yellow-400/50",
        "bg-gradient-to-br from-yellow-50/50 via-white to-orange-50/50",
        "min-h-[200px] flex flex-col items-center justify-center p-6 text-center",
        "cursor-pointer group hover:border-yellow-400 transition-all",
        className
      )}
      onClick={handleClick}
    >
      {/* Lock icon */}
      <div className="p-3 rounded-full bg-yellow-100 mb-4 group-hover:scale-110 transition-transform">
        <Lock className="h-6 w-6 text-yellow-600" />
      </div>

      {/* Count */}
      <p className="text-2xl font-bold text-foreground mb-1">
        +{remainingCount} more
      </p>

      {/* Description */}
      <p className="text-sm text-muted-foreground mb-4">
        conversation excerpts available to members
      </p>

      {/* CTA Button */}
      <button
        className={cn(
          "inline-flex items-center gap-2 px-5 py-2.5 rounded-full",
          "bg-yellow-500 hover:bg-yellow-400 text-yellow-950 font-semibold text-sm",
          "shadow-lg shadow-yellow-500/20 hover:shadow-xl hover:shadow-yellow-500/30",
          "transition-all group-hover:scale-105"
        )}
      >
        <Crown className="h-4 w-4" />
        <span>{isAuthenticated ? 'Upgrade to Unlock' : 'Join as a Viewer'}</span>
        <ArrowRight className="h-4 w-4" />
      </button>

      {/* Background decoration */}
      <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-yellow-200/30 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -top-8 -left-8 w-24 h-24 bg-orange-200/30 rounded-full blur-2xl pointer-events-none" />
    </article>
  );
};

// Search locked paywall component
interface SearchLockedPaywallProps {
  searchQuery: string;
  resultCount: number;
  positiveCount: number;
  warningCount: number;
  isAuthenticated: boolean;
  onUpgradeClick: () => void;
}

export const SearchLockedPaywall: React.FC<SearchLockedPaywallProps> = ({
  searchQuery,
  resultCount,
  positiveCount,
  warningCount,
  isAuthenticated,
  onUpgradeClick,
}) => {
  const handleClick = () => {
    if (isAuthenticated) {
      onUpgradeClick();
    } else {
      const tiersSection = document.getElementById('tiers-section');
      if (tiersSection) {
        const offset = 100;
        const elementPosition = tiersSection.getBoundingClientRect().top + window.pageYOffset;
        window.scrollTo({ top: elementPosition - offset, behavior: 'smooth' });
      }
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="relative overflow-hidden border-2 border-yellow-500/50 rounded-2xl p-8 sm:p-10 shadow-xl bg-gradient-to-br from-yellow-500/10 via-white to-orange-500/10">
        <div className="absolute inset-0 bg-gradient-to-t from-white/80 via-transparent to-transparent" />
        <div className="relative z-10 text-center">
          <div className="p-4 rounded-full bg-yellow-500/20 mx-auto mb-4 w-fit">
            <Lock className="h-8 w-8 text-yellow-600" />
          </div>
          <h3 className="text-2xl font-bold text-foreground mb-2">
            {resultCount} excerpts found for "{searchQuery}"
          </h3>
          <div className="flex items-center justify-center gap-4 text-sm mb-4">
            {positiveCount > 0 && (
              <span className="text-green-600 font-medium">
                {positiveCount} recommended
              </span>
            )}
            {warningCount > 0 && (
              <span className="text-orange-600 font-medium">
                {warningCount} concerns
              </span>
            )}
          </div>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Search results are a member feature. Join to unlock full access to all vendor conversation excerpts, concerns, and dealer insights.
          </p>
          <button
            onClick={handleClick}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-yellow-500 hover:bg-yellow-400 text-yellow-950 font-bold text-base shadow-lg hover:shadow-xl transition-all"
          >
            <Crown className="h-5 w-5" />
            <span>{isAuthenticated ? 'Upgrade to Unlock' : 'Join as a Viewer'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpgradeTeaser;
