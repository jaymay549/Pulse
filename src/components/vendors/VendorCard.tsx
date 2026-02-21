import React from "react";
import {
  Quote,
  Lock,
  ThumbsUp,
  AlertTriangle,
  Lightbulb,
  Crown,
  Globe,
} from "lucide-react";
import { VendorEntry } from "@/hooks/useVendorReviews";
import { VendorResponse } from "@/hooks/useVendorResponses";
import { parseMarkdown } from "@/utils/markdown";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import VendorResponseSection from "./VendorResponseSection";

/**
 * Replaces **** patterns (redacted vendor names from backend) with a blur effect
 */
const blurRedactedContent = (text: string): React.ReactNode => {
  // Backend sends **** for redacted vendor names - show as blurred placeholder
  const parts = text.split(/(\*{4})/g);
  if (parts.length === 1) return text;

  return parts.map((part, index) => {
    if (part === "****") {
      return (
        <span
          key={index}
          className="inline-block px-2 py-0.5 bg-foreground/10 rounded blur-[4px] select-none"
          title="Vendor name redacted"
        >
          Vendor
        </span>
      );
    }
    return part;
  });
};

/**
 * Parses markdown and applies blur to redacted content
 */
const parseMarkdownWithBlur = (
  text: string,
  isRedacted: boolean,
): React.ReactNode => {
  if (!isRedacted) {
    return parseMarkdown(text);
  }
  // For redacted content, apply blur effect to **** patterns
  return blurRedactedContent(text);
};

const renderQuote = (text: string, isRedacted: boolean): React.ReactNode => {
  return parseMarkdownWithBlur(text, isRedacted);
};

const formatMemberDate = (dateString?: string): string => {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    const month = date.toLocaleDateString("en-US", { month: "short" });
    const year = date.getFullYear();
    return `${month} ${year}`;
  } catch {
    return "";
  }
};

interface VendorCardProps {
  entry: VendorEntry;
  isLocked: boolean;
  showVendorNames: boolean;
  isFullAccess: boolean;
  isAuthenticated: boolean;
  vendorResponse?: VendorResponse | null;
  vendorWebsite?: string | null;
  vendorLogo?: string | null;
  canRespondAsVendor?: boolean;
  onAddResponse?: (text: string) => Promise<boolean>;
  onUpdateResponse?: (responseId: string, text: string) => Promise<boolean>;
  onDeleteResponse?: (responseId: string) => Promise<boolean>;
  onCardClick?: (entry: VendorEntry) => void;
  onVendorClick?: (vendorName: string) => void;
  onUpgradeClick?: () => void;
}

export const VendorCard: React.FC<VendorCardProps> = ({
  entry,
  isLocked,
  showVendorNames,
  isFullAccess,
  isAuthenticated,
  vendorResponse,
  vendorWebsite,
  vendorLogo,
  canRespondAsVendor,
  onAddResponse,
  onUpdateResponse,
  onDeleteResponse,
  onCardClick,
  onVendorClick,
  onUpgradeClick,
}) => {
  const getTypeStyles = () => {
    switch (entry.type) {
      case "warning":
        return {
          border: "border-l-2 border-l-red-500 border-border/40",
          bg: "bg-transparent hover:bg-red-500/5",
          badge: "text-red-700",
          icon: <AlertTriangle className="h-3.5 w-3.5" />,
          label: "WARNING",
        };
      case "positive":
        return {
          border: "border-l-2 border-l-green-500 border-border/40",
          bg: "bg-transparent hover:bg-green-500/5",
          badge: "text-green-700",
          icon: <ThumbsUp className="h-3.5 w-3.5" />,
          label: "RECOMMENDED",
        };
      default:
        return {
          border: "border-l-2 border-l-primary border-border/40",
          bg: "bg-transparent hover:bg-primary/5",
          badge: "text-primary",
          icon: <Lightbulb className="h-3.5 w-3.5" />,
          label: "STRATEGY",
        };
    }
  };

  const styles = getTypeStyles();

  const handleClick = () => {
    if (!isLocked && onCardClick) {
      onCardClick(entry);
    }
  };

  // Locked card logic:
  // - If showVendorNames is true (vendor-specific view): full blur, no content preview
  // - If showVendorNames is false (main page browsing): show blurred content preview (safe since vendor is hidden)
  if (isLocked) {
    // Check if vendor name is valid (not redacted) for navigation
    const hasValidVendorName =
      entry.vendorName && !entry.vendorName.includes("****");

    // Determine if we should show content preview (only on main page where vendor is hidden)
    const showContentPreview =
      !showVendorNames &&
      entry.quote &&
      !entry.quote.includes("[Content locked");

    const handleLockedCardClick = () => {
      // Navigate to vendor profile page if vendor name is valid and shown
      if (onVendorClick && hasValidVendorName && showVendorNames) {
        onVendorClick(entry.vendorName!);
      }
    };

    return (
      <article
        onClick={handleLockedCardClick}
        className={`
          relative overflow-hidden border border-border/40
          transition-colors duration-200 group
          ${hasValidVendorName && showVendorNames ? "cursor-pointer" : ""}
          ${styles.border} ${styles.bg}
        `}
      >
        <div className="px-5 py-4 flex flex-col h-full min-h-[190px]">
          {/* Vendor Name - Only show in vendor-specific view with valid name */}
          {showVendorNames && hasValidVendorName && (
            <div className="mb-3 flex items-center gap-3">
              <Avatar className="h-10 w-10 border border-border shrink-0">
                <AvatarImage
                  src={vendorLogo || undefined}
                  alt={entry.vendorName}
                />
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                  {entry.vendorName!.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h3
                  className={`
                    text-lg font-bold text-foreground leading-tight inline
                    ${onVendorClick ? "hover:text-primary transition-colors hover:underline cursor-pointer" : ""}
                  `}
                  onClick={(e) => {
                    if (onVendorClick && hasValidVendorName) {
                      e.stopPropagation();
                      onVendorClick(entry.vendorName!);
                    }
                  }}
                >
                  {entry.vendorName}
                </h3>
              </div>
            </div>
          )}

          {/* Header: Type badge + Lock indicator */}
          <div className="flex items-center justify-between mb-3">
            <div className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.08em] uppercase">
              <span className={styles.badge}>{styles.label}</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground">Member insight</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" />
              <span className="font-medium">Locked</span>
            </div>
          </div>

          {/* Content area - show preview on main page, full blur on vendor-specific view */}
          {showContentPreview ? (
            <div className="flex-1 mb-4 space-y-3">
              {/* Title preview - blur any redacted vendor names */}
              {entry.title && (
                <p className="text-sm font-medium text-foreground/80 line-clamp-2">
                  {blurRedactedContent(entry.title)}
                </p>
              )}
              {/* Quote preview - blur any redacted vendor names */}
              <div className="relative">
                <Quote className="absolute left-0 top-0 h-4 w-4 text-muted-foreground/30" />
                <p className="text-sm text-foreground/70 leading-relaxed line-clamp-3 pl-6">
                  "{blurRedactedContent(entry.quote)}"
                </p>
              </div>
              <p className="text-xs text-muted-foreground italic">
                Upgrade to see which vendor this is about
              </p>
            </div>
          ) : (
            <div className="flex-1 space-y-2 mb-4">
              <div className="h-5 w-3/4 bg-foreground/10 rounded blur-[3px]" />
              <div className="h-4 w-full bg-foreground/5 rounded blur-[2px]" />
              <div className="h-4 w-5/6 bg-foreground/5 rounded blur-[2px]" />
              <div className="h-4 w-2/3 bg-foreground/5 rounded blur-[2px]" />
              <p className="text-xs text-muted-foreground italic pt-2">
                Upgrade to read the full excerpt
              </p>
            </div>
          )}

          {/* Centered CTA */}
          <div className="flex justify-center">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onUpgradeClick) {
                  onUpgradeClick();
                } else {
                  // Fallback: scroll to tiers section if no handler provided
                  const tiersSection = document.getElementById("tiers-section");
                  if (tiersSection) {
                    const offset = 100;
                    const elementPosition =
                      tiersSection.getBoundingClientRect().top +
                      window.pageYOffset;
                    window.scrollTo({
                      top: elementPosition - offset,
                      behavior: "smooth",
                    });
                  }
                }
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-yellow-500 hover:bg-yellow-400 text-yellow-950 font-semibold text-sm transition-colors"
            >
              <Crown className="h-4 w-4" />
              <span>
                {isAuthenticated ? "Unlock Vendor" : "Join to Unlock"}
              </span>
            </button>
          </div>
        </div>
      </article>
    );
  }

  // Check if quote contains locked placeholder text from API
  const hasLockedPlaceholder =
    entry.quote.includes("[Content locked") ||
    entry.quote.includes("[content locked") ||
    entry.quote.includes("Join Pro to view") ||
    entry.quote.includes("Upgrade to Pro");

  // Unlocked card layout
  return (
    <article
      onClick={handleClick}
      className={`
        relative overflow-hidden border border-border/40
        transition-colors duration-200 cursor-pointer group flex flex-col h-full
        ${styles.border} ${styles.bg}
      `}
    >
      <div className="px-5 py-4 flex flex-col flex-1 min-h-0">
        <div className="flex-1 min-h-0 flex flex-col">
          {/* Vendor Name - Editorial style with logo */}
          {entry.vendorName && showVendorNames && (
            <div className="mb-2 flex items-center gap-3">
              {/* Vendor Logo - Always show Avatar with logo or initials fallback */}
              <Avatar className="h-10 w-10 border border-border shrink-0">
                <AvatarImage
                  src={vendorLogo || undefined}
                  alt={entry.vendorName}
                />
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                  {entry.vendorName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h3
                  className={`
                  text-lg font-bold text-foreground leading-tight inline
                  ${
                    onVendorClick
                      ? "hover:text-primary transition-colors hover:underline cursor-pointer"
                      : ""
                  }
                `}
                  onClick={(e) => {
                    if (onVendorClick && entry.vendorName) {
                      e.stopPropagation();
                      onVendorClick(entry.vendorName);
                    }
                  }}
                >
                  {entry.vendorName}
                </h3>
                {/* Verified vendor website link */}
                {vendorWebsite && (
                  <a
                    href={vendorWebsite}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 ml-2 text-xs text-primary hover:underline"
                  >
                    <Globe className="h-3 w-3" />
                    <span className="hidden sm:inline">Website</span>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Title/Headline */}
          {entry.title && (
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
              {parseMarkdownWithBlur(entry.title, !showVendorNames)}
            </p>
          )}

          {/* Quote - Handle locked placeholder gracefully */}
          <div className="relative">
            {hasLockedPlaceholder ? (
              <div className="py-4 px-4 rounded-lg bg-muted/40 border border-border/50 text-center">
                <Lock className="h-5 w-5 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground font-medium">
                  Full excerpt available to members
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Join to read what dealers are saying
                </p>
              </div>
            ) : (
              <>
                <Quote className="absolute left-0 top-0 h-4 w-4 text-muted-foreground/30 mr-2" />
                <p className="text-sm text-foreground/80 leading-relaxed line-clamp-4 pl-6">
                  "{renderQuote(entry.quote, !showVendorNames)}"
                </p>
              </>
            )}
          </div>

          {/* Explanation context */}
          {entry.explanation && !hasLockedPlaceholder && (
            <p className="text-xs text-muted-foreground/70 leading-relaxed line-clamp-2 mt-2 pl-6">
              {entry.explanation}
            </p>
          )}

          {/* Vendor response: display when exists, or show "Respond" when vendor can add */}
          {(vendorResponse || (canRespondAsVendor && entry.vendorName)) &&
            onAddResponse &&
            onUpdateResponse &&
            onDeleteResponse && (
              <div className="mb-3" onClick={(e) => e.stopPropagation()}>
                <VendorResponseSection
                  response={vendorResponse || null}
                  canRespond={canRespondAsVendor ?? false}
                  vendorName={entry.vendorName || ""}
                  onAddResponse={onAddResponse}
                  onUpdateResponse={onUpdateResponse}
                  onDeleteResponse={onDeleteResponse}
                />
              </div>
            )}
        </div>
        {/* Footer: Type badge + Member attribution - pinned to bottom */}
        <div className="mt-auto pt-3 border-t border-border/50">
          <div className="flex flex-row flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground leading-snug">
              Circles Member
              {formatMemberDate(entry.conversationTime)
                ? ` · ${formatMemberDate(entry.conversationTime)}`
                : ""}
            </p>
            <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.08em] uppercase">
              {styles.icon}
              <span className={styles.badge}>{styles.label}</span>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
};

export default VendorCard;
