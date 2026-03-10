import React from "react";
import { ThumbsUp, AlertTriangle, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { TypeFilter } from "@/hooks/useVendorFilters";

interface FilterBarProps {
  typeFilter: TypeFilter;
  onTypeFilterChange: (filter: TypeFilter) => void;
  positiveCount: number;
  warningCount: number;
  totalCount: number;
  canAccessWarnings: boolean;
  onWarningsLocked?: () => void;
  className?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  typeFilter,
  onTypeFilterChange,
  positiveCount,
  warningCount,
  totalCount,
  canAccessWarnings,
  onWarningsLocked,
  className,
}) => {
  const handleWarningsClick = () => {
    if (!canAccessWarnings) {
      onWarningsLocked?.();
      return;
    }
    onTypeFilterChange("warning");
  };

  return (
    <div className={cn("flex items-center gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-x-visible", className)}>
      {/* All Filter */}
      <FilterButton
        isActive={typeFilter === "all"}
        onClick={() => onTypeFilterChange("all")}
      >
        All
        <CountBadge count={totalCount} isActive={typeFilter === "all"} />
      </FilterButton>

      {/* Recommended Filter */}
      <FilterButton
        isActive={typeFilter === "positive"}
        onClick={() => onTypeFilterChange("positive")}
        variant="positive"
      >
        <ThumbsUp className="h-3.5 w-3.5" />
        Recommended
        <CountBadge count={positiveCount} isActive={typeFilter === "positive"} />
      </FilterButton>

      {/* Concerns Filter */}
      <FilterButton
        isActive={typeFilter === "warning"}
        onClick={handleWarningsClick}
        variant="warning"
        disabled={!canAccessWarnings && warningCount === 0}
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        Concerns
        <CountBadge count={warningCount} isActive={typeFilter === "warning"} />
        {!canAccessWarnings && warningCount > 0 && (
          <Lock className="h-3 w-3 opacity-60" />
        )}
      </FilterButton>
    </div>
  );
};

interface FilterButtonProps {
  children: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
  variant?: "default" | "positive" | "warning";
  disabled?: boolean;
}

const FilterButton: React.FC<FilterButtonProps> = ({
  children,
  isActive,
  onClick,
  variant = "default",
  disabled = false,
}) => {
  const variantStyles = {
    default: {
      active: "bg-foreground text-background",
      inactive: "bg-muted/50 text-foreground hover:bg-muted",
    },
    positive: {
      active: "bg-green-600 text-white",
      inactive: "bg-green-50 text-green-700 hover:bg-green-100",
    },
    warning: {
      active: "bg-red-600 text-white",
      inactive: "bg-red-50 text-red-700 hover:bg-red-100",
    },
  };

  const styles = variantStyles[variant];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0",
        isActive ? styles.active : styles.inactive,
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      {children}
    </button>
  );
};

interface CountBadgeProps {
  count: number;
  isActive: boolean;
}

const CountBadge: React.FC<CountBadgeProps> = ({ count, isActive }) => {
  return (
    <span className={cn(
      "text-xs tabular-nums",
      isActive ? "opacity-80" : "opacity-60"
    )}>
      ({count})
    </span>
  );
};

export default FilterBar;
