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
import { parseMarkdown, REVIEW_LINKIFY_OPTIONS } from "@/utils/markdown";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import VendorResponseSection from "./VendorResponseSection";

/**
 * Replaces **** patterns (redacted vendor names from backend) with a blur effect
 */
const blurRedactedContent = (text: string): React.ReactNode => {
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

const parseMarkdownWithBlur = (
  text: string,
  isRedacted: boolean,
  knownVendors?: string[],
): React.ReactNode => {
  if (!isRedacted) {
    return parseMarkdown(text, {
      ...REVIEW_LINKIFY_OPTIONS,
      knownVendors: knownVendors ?? [],
    });
  }
  return blurRedactedContent(text);
};

const renderQuote = (
  text: string,
  isRedacted: boolean,
  knownVendors?: string[],
): React.ReactNode => {
  return parseMarkdownWithBlur(text, isRedacted, knownVendors);
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
  knownVendors?: string[];
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
  knownVendors,
}) => {
  const getTypeStyles = () => {
    switch (entry.type) {
      case "warning":
        return {
          border: "border-l-[2px] border-l-red-400",
          bg: "bg-white hover:bg-red-50/30",
          badge: "text-red-500",
          icon: <AlertTriangle className="h-3 w-3" />,
          label: "WARNING",
        };
      case "positive":
        return {
          border: "border-l-[2px] border-l-emerald-400",
          bg: "bg-white hover:bg-emerald-50/30",
          badge: "text-emerald-600",
          icon: <ThumbsUp className="h-3 w-3" />,
          label: "RECOMMENDED",
        };
      default:
        return {
          border: "border-l-[2px] border-l-amber-400",
          bg: "bg-white hover:bg-amber-50/20",
          badge: "text-amber-600",
          icon: <Lightbulb className="h-3 w-3" />,
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

  // Locked card
  if (isLocked) {
    const hasValidVendorName =
      entry.vendorName && !entry.vendorName.includes("****");

    const showContentPreview =
      !showVendorNames &&
      entry.quote &&
      !entry.quote.includes("[Content locked");

    const handleLockedCardClick = () => {
      if (onVendorClick && hasValidVendorName && showVendorNames) {
        onVendorClick(entry.vendorName!);
      }
    };

    return (
      <article
        onClick={handleLockedCardClick}
        className={`
          relative overflow-hidden rounded-xl transition-all duration-200 group
          shadow-[0_0_0_1px_rgba(0,0,0,0.04)]
          hover:shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_4px_16px_-4px_rgba(0,0,0,0.06)]
          ${hasValidVendorName && showVendorNames ? "cursor-pointer" : ""}
          ${styles.border} ${styles.bg}
        `}
      >
        <div className="px-5 py-4 flex flex-col h-full min-h-[190px]">
          {showVendorNames && hasValidVendorName && (
            <div className="mb-3 flex items-center gap-3">
              <Avatar className="h-9 w-9 border border-black/[0.06] shrink-0">
                <AvatarImage
                  src={vendorLogo || undefined}
                  alt={entry.vendorName}
                />
                <AvatarFallback className="bg-amber-50 text-amber-700 text-xs font-bold">
                  {entry.vendorName!.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h3
                  className={`
                    text-base font-bold text-foreground leading-tight inline tracking-tight
                    ${onVendorClick ? "hover:text-amber-700 transition-colors cursor-pointer" : ""}
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

          <div className="flex items-center justify-between mb-3">
            <div className="inline-flex items-center gap-2 text-[10px] font-semibold tracking-[0.1em] uppercase">
              <span className={styles.badge}>{styles.label}</span>
              <span className="text-foreground/15">·</span>
              <span className="text-foreground/30">Member insight</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-foreground/25">
              <Lock className="h-3 w-3" />
              <span className="font-medium">Locked</span>
            </div>
          </div>

          {showContentPreview ? (
            <div className="flex-1 mb-4 space-y-3">
              {entry.title && (
                <p className="text-sm font-medium text-foreground/70 line-clamp-2">
                  {blurRedactedContent(entry.title)}
                </p>
              )}
              <div className="relative">
                <Quote className="absolute left-0 top-0.5 h-3.5 w-3.5 text-foreground/10" />
                <p className="text-sm text-foreground/50 leading-relaxed line-clamp-3 pl-5">
                  "{blurRedactedContent(entry.quote)}"
                </p>
              </div>
              <p className="text-[11px] text-foreground/30 italic">
                Upgrade to see which vendor this is about
              </p>
            </div>
          ) : (
            <div className="flex-1 space-y-2 mb-4">
              <div className="h-4 w-3/4 bg-foreground/[0.05] rounded-md blur-[2px]" />
              <div className="h-3.5 w-full bg-foreground/[0.03] rounded-md blur-[2px]" />
              <div className="h-3.5 w-5/6 bg-foreground/[0.03] rounded-md blur-[2px]" />
              <div className="h-3.5 w-2/3 bg-foreground/[0.03] rounded-md blur-[2px]" />
              <p className="text-[11px] text-foreground/30 italic pt-2">
                Upgrade to read the full excerpt
              </p>
            </div>
          )}

          <div className="flex justify-center">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onUpgradeClick) {
                  onUpgradeClick();
                } else {
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
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-semibold text-[13px] transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <Crown className="h-3.5 w-3.5" />
              <span>
                {isAuthenticated ? "Unlock Vendor" : "Join to Unlock"}
              </span>
            </button>
          </div>
        </div>
      </article>
    );
  }

  const hasLockedPlaceholder =
    entry.quote.includes("[Content locked") ||
    entry.quote.includes("[content locked") ||
    entry.quote.includes("Join Pro to view") ||
    entry.quote.includes("Upgrade to Pro");

  // Unlocked card
  return (
    <article
      onClick={handleClick}
      className={`
        relative overflow-hidden rounded-xl transition-all duration-200 cursor-pointer group flex flex-col h-full
        shadow-[0_0_0_1px_rgba(0,0,0,0.04)]
        hover:shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_4px_16px_-4px_rgba(0,0,0,0.06)]
        ${styles.border} ${styles.bg}
      `}
    >
      <div className="px-5 py-4 flex flex-col flex-1 min-h-0">
        <div className="flex-1 min-h-0 flex flex-col">
          {entry.vendorName && showVendorNames && (
            <div className="mb-2 flex items-center gap-3">
              <Avatar className="h-9 w-9 border border-black/[0.06] shrink-0">
                <AvatarImage
                  src={vendorLogo || undefined}
                  alt={entry.vendorName}
                />
                <AvatarFallback className="bg-amber-50 text-amber-700 text-xs font-bold">
                  {entry.vendorName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h3
                  className={`
                  text-base font-bold text-foreground leading-tight inline tracking-tight
                  ${
                    onVendorClick
                      ? "hover:text-amber-700 transition-colors cursor-pointer"
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
                {vendorWebsite && (
                  <a
                    href={vendorWebsite}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 ml-2 text-[11px] text-foreground/30 hover:text-amber-600 transition-colors"
                  >
                    <Globe className="h-2.5 w-2.5" />
                    <span className="hidden sm:inline">Website</span>
                  </a>
                )}
              </div>
            </div>
          )}

          {entry.title && (
            <p className="text-[14px] text-foreground/75 mb-3 line-clamp-2 leading-relaxed">
              {parseMarkdownWithBlur(
                entry.title,
                !showVendorNames,
                [
                  ...(knownVendors ?? []),
                  ...(entry.vendorName ? [entry.vendorName] : []),
                ],
              )}
            </p>
          )}

          <div className="relative">
            {hasLockedPlaceholder ? (
              <div className="py-4 px-4 rounded-xl bg-foreground/[0.02] border border-black/[0.04] text-center">
                <Lock className="h-4 w-4 text-foreground/20 mx-auto mb-2" />
                <p className="text-sm text-foreground/50 font-medium">
                  Full excerpt available to members
                </p>
                <p className="text-[11px] text-foreground/30 mt-1">
                  Join to read what dealers are saying
                </p>
              </div>
            ) : (
              <>
                <Quote className="absolute left-0 top-0.5 h-3.5 w-3.5 text-foreground/10" />
                <p className="text-[14px] text-foreground/70 leading-relaxed line-clamp-4 pl-5">
                  "{renderQuote(
                    entry.quote,
                    !showVendorNames,
                    [
                      ...(knownVendors ?? []),
                      ...(entry.vendorName ? [entry.vendorName] : []),
                    ],
                  )}"
                </p>
              </>
            )}
          </div>

          {entry.explanation && !hasLockedPlaceholder && (
            <p className="text-[11px] text-foreground/35 leading-relaxed line-clamp-2 mt-2 pl-5">
              {entry.explanation}
            </p>
          )}

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
        {/* Footer */}
        <div className="mt-auto pt-3 border-t border-black/[0.04]">
          <div className="flex flex-row flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-foreground/30 leading-snug">
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
