import React from "react";
import {
  ThumbsUp,
  AlertTriangle,
  Lightbulb,
  Share2,
  Flag,
  Quote,
  Lock,
  Crown,
  Globe,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { VendorEntry } from "@/hooks/useVendorReviews";
import { VendorResponse } from "@/hooks/useVendorResponses";
import { parseMarkdown } from "@/utils/markdown";
import { useIsMobile } from "@/hooks/use-mobile";
import VendorResponseSection from "./VendorResponseSection";

interface VendorCardDetailProps {
  entry: VendorEntry | null;
  isOpen: boolean;
  onClose: () => void;
  onShare?: (entry: VendorEntry) => void;
  onDownload?: (entry: VendorEntry) => void;
  onVendorSelect?: (vendorName: string) => void;
  onCategorySelect?: (categoryId: string) => void;
  vendorLogo?: string | null;
  vendorWebsite?: string | null;
  // Vendor response props
  vendorResponse?: VendorResponse | null;
  canRespondAsVendor?: boolean;
  onAddResponse?: (text: string) => Promise<boolean>;
  onUpdateResponse?: (responseId: string, text: string) => Promise<boolean>;
  onDeleteResponse?: (responseId: string) => Promise<boolean>;
}

const formatMemberDate = (dateString?: string): string => {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  } catch {
    return "";
  }
};

// Check if content is locked
const isContentLocked = (text: string): boolean => {
  return text.includes("[Content locked") || text.includes("Join Pro to view");
};

export const VendorCardDetail: React.FC<VendorCardDetailProps> = ({
  entry,
  isOpen,
  onClose,
  onShare,
  onVendorSelect,
  onCategorySelect,
  vendorLogo,
  vendorWebsite,
  vendorResponse,
  canRespondAsVendor,
  onAddResponse,
  onUpdateResponse,
  onDeleteResponse,
}) => {
  const isMobile = useIsMobile();
  if (!entry) return null;

  const hasLockedContent =
    isContentLocked(entry.quote) ||
    (entry.title && isContentLocked(entry.title));

  const getTypeConfig = () => {
    switch (entry.type) {
      case "warning":
        return {
          badge: "bg-red-100 text-red-700 border-red-200",
          icon: <AlertTriangle className="h-4 w-4" />,
          label: "WARNING",
          accentColor: "text-red-600",
        };
      case "positive":
        return {
          badge: "bg-green-100 text-green-700 border-green-200",
          icon: <ThumbsUp className="h-4 w-4" />,
          label: "RECOMMENDED",
          accentColor: "text-green-600",
        };
      default:
        return {
          badge: "bg-primary/10 text-primary border-primary/20",
          icon: <Lightbulb className="h-4 w-4" />,
          label: "STRATEGY",
          accentColor: "text-primary",
        };
    }
  };

  const typeConfig = getTypeConfig();

  const handleShare = async () => {
    if (onShare) {
      onShare(entry);
    } else if (navigator.share) {
      try {
        await navigator.share({
          title: `${entry.vendorName} - CDG Circles`,
          text: `${entry.quote.slice(0, 100)}...`,
          url: window.location.href,
        });
      } catch {
        // User cancelled
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  const handleReport = () => {
    const subject = encodeURIComponent("Report");
    const body = encodeURIComponent(
      `Vendor: ${entry.vendorName}\n` +
        (entry.title ? `Title: ${entry.title}\n` : "") +
        `\nPlease provide details about your report:`,
    );
    window.location.href = `mailto:vendor-report@cardealershipguy.org?subject=${subject}&body=${body}`;
  };

  const handleVendorLink = () => {
    if (entry.vendorName && onVendorSelect) {
      onClose();
      onVendorSelect(entry.vendorName);
    }
  };

  const scrollToTiers = () => {
    onClose();
    setTimeout(() => {
      const tiersSection = document.getElementById("tiers-section");
      if (tiersSection) {
        const elementPosition =
          tiersSection.getBoundingClientRect().top + window.pageYOffset;
        window.scrollTo({ top: elementPosition - 100, behavior: "smooth" });
      }
    }, 100);
  };

  // Locked content view
  if (hasLockedContent) {
    const lockedContent = (
      <div className="flex flex-col h-full p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold border ${typeConfig.badge}`}
          >
            {typeConfig.icon}
            {typeConfig.label}
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4 mb-6">
          <Avatar className="h-12 w-12 border border-border">
            <AvatarImage src={vendorLogo || undefined} alt={entry.vendorName} />
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
              {entry.vendorName?.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <DialogTitle className="text-2xl font-bold text-foreground">
              {entry.vendorName}
            </DialogTitle>
            <div className="flex items-center gap-3 mt-1 text-xs">
              {onVendorSelect && entry.vendorName && (
                <button
                  onClick={handleVendorLink}
                  className="text-primary font-semibold hover:underline"
                >
                  View vendor
                </button>
              )}
              {vendorWebsite && (
                <a
                  href={vendorWebsite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                >
                  <Globe className="h-3 w-3" />
                  Website
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Locked State */}
        <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
          <div className="w-16 h-16 rounded-full bg-secondary/20 flex items-center justify-center mb-4">
            <Lock className="h-8 w-8 text-yellow-600" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">
            Full Excerpt Locked
          </h3>
          <p className="text-muted-foreground mb-6 max-w-sm">
            Get access to the complete conversation excerpt and all
            dealer feedback on {entry.vendorName}.
          </p>
          <Button
            variant="yellow"
            size="lg"
            className="font-bold"
            onClick={scrollToTiers}
          >
            <Crown className="h-4 w-4 mr-2" />
            Unlock Full Access
          </Button>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t">
          <p className="text-xs text-center text-muted-foreground">
            Join Pro to access 1,300+ real dealer conversation excerpts
          </p>
        </div>
      </div>
    );

    if (isMobile) {
      return (
        <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
          <DrawerContent className="max-h-[85vh]">
            {lockedContent}
            <div className="h-6" />
          </DrawerContent>
        </Drawer>
      );
    }

    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md p-0">
          {lockedContent}
        </DialogContent>
      </Dialog>
    );
  }

  // Full content view (unlocked)
  const content = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 pb-0">
        <div className="flex items-start justify-between">
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold border ${typeConfig.badge}`}
          >
            {typeConfig.icon}
            {typeConfig.label}
          </div>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <Avatar className="h-12 w-12 border border-border">
            <AvatarImage src={vendorLogo || undefined} alt={entry.vendorName} />
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
              {entry.vendorName?.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <DialogTitle className="text-2xl font-bold text-foreground">
              {entry.vendorName}
            </DialogTitle>
            <div className="flex items-center gap-3 mt-1 text-xs">
              {onVendorSelect && entry.vendorName && (
                <button
                  onClick={handleVendorLink}
                  className="text-primary font-semibold hover:underline"
                >
                  View vendor
                </button>
              )}
              {vendorWebsite && (
                <a
                  href={vendorWebsite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                >
                  <Globe className="h-3 w-3" />
                  Website
                </a>
              )}
            </div>
          </div>
        </div>
        {entry.title && !isContentLocked(entry.title) && (
          <p className="text-muted-foreground text-sm mt-1">
            {parseMarkdown(entry.title)}
          </p>
        )}
      </div>

      {/* Content */}
      <div className="p-6 space-y-6 overflow-y-auto">
        {/* Quote Section */}
        <div className="relative bg-muted/30 rounded-xl p-6">
          <Quote
            className={`absolute left-4 top-1/2 -translate-y-1/2 h-8 w-8 ${typeConfig.accentColor} opacity-20 mr-3`}
          />
          <blockquote className="relative z-10 pl-16">
            <p className="text-foreground text-base leading-relaxed italic">
              "{parseMarkdown(entry.quote)}"
            </p>
          </blockquote>
        </div>

        {/* Explanation Section */}
        {entry.explanation && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Lightbulb className="h-3.5 w-3.5" />
              Explanation
            </h4>
            <p className="text-sm text-foreground/80 leading-relaxed">
              {parseMarkdown(entry.explanation)}
            </p>
          </div>
        )}

        {/* Vendor Response (display + edit/add via shared component) */}
        {(vendorResponse || canRespondAsVendor) &&
          onAddResponse &&
          onUpdateResponse &&
          onDeleteResponse &&
          entry.vendorName && (
            <VendorResponseSection
              response={vendorResponse || null}
              canRespond={canRespondAsVendor ?? false}
              vendorName={entry.vendorName}
              onAddResponse={onAddResponse}
              onUpdateResponse={onUpdateResponse}
              onDeleteResponse={onDeleteResponse}
            />
          )}

        {/* Divider */}
        <div className="h-px bg-border" />

        {/* Attribution */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Circles Member
            {formatMemberDate(entry.conversationTime)
              ? ` · ${formatMemberDate(entry.conversationTime)}`
              : ""}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleShare}
            className="flex-1"
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={handleReport}
          >
            <Flag className="h-4 w-4 mr-2" />
            Report
          </Button>
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="max-h-[85vh]">
          {content}
          <div className="h-6" />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto p-0">
        {content}
      </DialogContent>
    </Dialog>
  );
};

export default VendorCardDetail;
