import React from "react";
import {
  Quote,
  Lock,
  ThumbsUp,
  AlertTriangle,
  Lightbulb,
  Crown,
  ShieldCheck,
  Globe,
} from "lucide-react";
import { VendorEntry } from "@/hooks/useVendorReviews";
import { VendorResponse } from "@/hooks/useVendorResponses";
import { parseMarkdown } from "@/utils/markdown";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Vendor names to blur for anonymous users
const vendorNamesToBlur = [
  "Tekion", "CDK", "CDK Service", "CDK Global", "CDK Drive", "CDK SimplePay",
  "DriveCentric", "Drive Centric", "Drive centric",
  "VinSolutions", "Vin Solutions", "Vin", "Auto/mate", "Automate", "Dealersocket",
  "DealerSocket", "Dealer Socket", "Reynolds", "Reynolds and Reynolds", "Autosoft",
  "Proton", "Client Command", "Foundation Direct", "Foundation", "PBS",
  "Reverse Risk", "DealerTrack", "Dealer Track", "Eleads", "eLeads", "Solera",
  "QoreAI", "Qore", "RMI",
  "Gubagoo", "Podium", "Autofi", "AutoFi", "Trade Pending", "TradePending",
  "CarNow", "Roadster", "Monogram", "SmartPath", "Smartpath", "UpdatePromise",
  "Pure Cars", "PureCars", "Purecars", "Force Marketing", "Clarivoy", "Capital One", "Cap One",
  "Mudd", "Mudd mailers", "Cedar Marketing", "Go High Level", "GoHighLevel",
  "gohighlevel", "driveai", "automotiveaccelerator", "Epsilon", "Strategic",
  "Willowood", "Willowood Ventures", "Adperance", "Catalyst", "SMedia", "Smedia",
  "Dealer Inspire", "DI", "Dealer.com", "Team Velocity", "Team V", "OverFuel",
  "SpeedLayer", "Motive", "TVI Marketpro3", "Marketpro3", "Sokal",
  "Click Here Digital", "Autominer", "Dealer Insights", "Dealer World",
  "Dealer E-Process", "Dealer Eprocess", "DealerOn", "Tekobi", "Tecobi",
  "Hamlin And Associates", "Hamlin", "Constellations", "AEO", "GEO",
  "Dynatron", "Armatus", "Armatus FOPC", "FOPC", "Service Department Solutions",
  "Xtime", "DealerFX", "Dealer FX", "BG/TORQ", "TORQ", "BG", "Smart VMA",
  "TekWall", "techWall", "BizzyCar", "Avantaguard", "Workflow 360",
  "Mitchell Pro Demand", "Mitchell", "Jupiter", "Scott Russo", "Assurant",
  "Auto Alert", "AutoAlert", "Apollo", "Fullpath",
  "AMP", "Mastermind", "Automotive Mastermind",
  "Rapid Recon", "Hubcap Haven", "iRecon", "VINCUE",
  "Numa", "Warrcloud", "Impel AI", "Impel", "Matador AI", "Matador", "Pam",
  "AlphaDrive", "AlphaDrive AI", "AutoAce", "Kenect", "Kenect.Ai", "Autolabs",
  "Cora", "Cari AI", "CarWars", "Covideo", "Vibecodeapp", "Vibecode",
  "Claude", "Claude Code", "Cowork", "ChatGPT", "Gemini", "Grok",
  "Co-pilot", "Copilot", "AutoPixel", "Retell", "Elevenlabs",
  "Precision Inventory", "Precision IM", "Carfax", "Carfax Listings", "KBB ICO", "KBB",
  "Kelley Blue Book", "Shiftly", "Signal", "AutoHub", "Auto Hub", "Skaivision",
  "Auto iPacket", "iPacket", "CULA", "Carpages", "WhipFlip", "Traderev", "Buyanycar",
  "Kijiji", "VAuto", "vAuto", "V-Auto", "Motoacquire", "AccuTrade",
  "Blackbook", "Car and Driver", "eAuto Appraisals", "KBB LeadDriver",
  "KBB Trade-in Advisor", "Trade-in Valet", "Autotrader ICO", "Vizauto",
  "Steve Shaw", "Chris Collins", "RockED", "Rock ED", "Rockstar", "NCM", "NCM 20",
  "Andy Elliott", "Andy", "NADA", "NADA Dealer Academy", "RevDojo", "Kyle Disher",
  "Sellchology", "Jonathan Dawson", "Proactive Training Solutions",
  "Jonathan Mast", "ComplyAuto", "Comply Auto", "EOS", "Ethos Group",
  "Next Level Auto Group", "Tenex", "M5",
  "Packer Thomas", "Brady Ware", "Crowe", "Woodward", "Woodward and Associates",
  "CorPay", "Yooz", "Cenpos", "Dealerpay", "DealerWorks", "Dealerworks", "Truvideo",
  "Budco", "Darwin", "Tyler Simms", "St. Sauveur", "Wihtium", "Withium",
  "Routeone", "RouteOne", "Protective",
  "Netchex", "Net Checks", "Paylocity", "ADP",
  "Wynns", "10mm", "Grantize",
  "Autel", "Vintel", "VINTEL", "VINSight", "Velocity Automotive", "Snap On",
  "Snap on Solus", "Solus", "Coats Company",
  "Bodyguard", "BayWatch", "Baywatch", "BayWatch Technologies", "UV Eye",
  "Stealth", "1Micro", "Field Effect", "Voisentry",
  "AutoCheck", "Autocheck", "Edmunds", "Cars.com", "CarGurus", "Cargurus", "Autotrader",
  "Facebook Marketplace", "Canada Drives", "Truecar", "Carvana", "AutoNation",
  "CallRevu", "Call Revu", "Test Track", "Volie", "Dealerwing", "Dealer wing",
  "Ring Central", "CallRail", "Revolver", "Text2drive", "GoTo", "Mitel", "Simple Fiber",
  "Helion", "A&R Solutions", "EV Connect", "Blink", "Ntiva", "OWL Consulting",
  "Qore", "Todd", "C4", "Google Sheets",
  "Auto Trust Alliance", "Triton", "Ford Protect", "KPA", "Complynet", "Mosaic",
  "Cox", "NCC", "700", "GMF", "GM IMR", "Lovable", "Replit",
  "GoTo Meeting", "Google Meets", "Fathom", "Firefly", "SalesForce", "Hubspot",
  "Zoom", "J H Corp",
  "Nissan DVB", "Nissan One", "Subaru SSLP", "Volvo Costco", "Ford EV",
  "Ford", "Lincoln", "Chevy", "Chevrolet", "GMC", "Toyota", "Lexus",
  "Hyundai", "Kia", "Nissan", "Rogue", "Honda", "Stellantis", "Subaru", "Volvo", "Ram",
  "Daily.therundown.ai", "The Rundown", "Voisentry", "Windowstickerlookup",
  "AI Prompts for Entrepreneurs", "Working Genius", "Patrick Lencioni",
  "Tuscany", "DriveAI", "AutomotiveAccelerator", "Roush", "Amazon"
];

const isWordBoundary = (char: string | undefined): boolean => {
  if (char === undefined) return true;
  return !/[a-zA-Z0-9]/.test(char);
};

const blurVendorNames = (text: string): React.ReactNode => {
  const result: React.ReactNode[] = [];
  let remainingText = text;
  let keyIndex = 0;

  const sortedVendors = [...vendorNamesToBlur].sort((a, b) => b.length - a.length);

  while (remainingText.length > 0) {
    let earliestIndex = -1;
    let matchedVendor = '';

    for (const vendor of sortedVendors) {
      const lowerRemaining = remainingText.toLowerCase();
      const lowerVendor = vendor.toLowerCase();
      let searchStart = 0;

      while (searchStart < lowerRemaining.length) {
        const index = lowerRemaining.indexOf(lowerVendor, searchStart);
        if (index === -1) break;

        const charBefore = remainingText[index - 1];
        const charAfter = remainingText[index + vendor.length];

        if (isWordBoundary(charBefore) && isWordBoundary(charAfter)) {
          if (earliestIndex === -1 || index < earliestIndex) {
            earliestIndex = index;
            matchedVendor = vendor;
          }
          break;
        }
        searchStart = index + 1;
      }
    }

    if (earliestIndex === -1) {
      result.push(remainingText);
      break;
    }

    if (earliestIndex > 0) {
      result.push(remainingText.substring(0, earliestIndex));
    }

    const matchedText = remainingText.substring(earliestIndex, earliestIndex + matchedVendor.length);
    result.push(
      <span key={keyIndex++} className="inline-block px-1 bg-foreground/10 rounded blur-[4px] select-none">
        {matchedText}
      </span>
    );

    remainingText = remainingText.substring(earliestIndex + matchedVendor.length);
  }

  return result.length > 0 ? result : text;
};

/**
 * Recursively extracts text content from React nodes
 */
const extractTextFromNode = (node: React.ReactNode): string => {
  if (typeof node === 'string') {
    return node;
  }

  if (typeof node === 'number' || typeof node === 'boolean') {
    return String(node);
  }

  if (node === null || node === undefined) {
    return '';
  }

  if (Array.isArray(node)) {
    return node.map(extractTextFromNode).join('');
  }

  if (React.isValidElement(node)) {
    const children = node.props.children;
    if (children === undefined || children === null) {
      return '';
    }
    return extractTextFromNode(children);
  }

  return '';
};

/**
 * Recursively processes React nodes to blur vendor names in text content
 */
const blurVendorNamesInNodes = (node: React.ReactNode, keyIndex: { current: number }): React.ReactNode => {
  if (typeof node === 'string') {
    return blurVendorNames(node);
  }

  if (typeof node === 'number' || typeof node === 'boolean' || node === null || node === undefined) {
    return node;
  }

  if (Array.isArray(node)) {
    return node.map((child) => blurVendorNamesInNodes(child, keyIndex));
  }

  if (React.isValidElement(node)) {
    // Extract text content to check if it contains vendor names
    const textContent = extractTextFromNode(node.props.children);

    // If the text content contains vendor names, we need to blur them
    // For now, we'll recursively process children
    const children = React.Children.map(node.props.children, (child) => {
      return blurVendorNamesInNodes(child, keyIndex);
    });

    return React.cloneElement(node, { ...node.props, key: `blur-${keyIndex.current++}` }, children);
  }

  return node;
};

/**
 * Parses markdown and optionally blurs vendor names
 */
const parseMarkdownWithBlur = (text: string, showVendorNames: boolean): React.ReactNode => {
  // Always parse markdown first to get React elements
  const parsed = parseMarkdown(text);

  if (showVendorNames) {
    return parsed;
  }

  // Blur vendor names in the parsed markdown
  const keyIndex = { current: 0 };
  return blurVendorNamesInNodes(parsed, keyIndex);
};

const renderQuote = (text: string, showVendorNames: boolean): React.ReactNode => {
  return parseMarkdownWithBlur(text, showVendorNames);
};

const formatMemberDate = (dateString?: string): string => {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    const month = date.toLocaleDateString('en-US', { month: 'short' });
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
  onCardClick,
  onVendorClick,
  onUpgradeClick
}) => {
  const getTypeStyles = () => {
    switch (entry.type) {
      case "warning":
        return {
          border: "border-l-4 border-l-red-500 border-t border-r border-b border-border/50",
          bg: "bg-white hover:bg-red-50/30",
          badge: "bg-red-100 text-red-700",
          icon: <AlertTriangle className="h-3.5 w-3.5" />,
          label: "WARNING"
        };
      case "positive":
        return {
          border: "border-l-4 border-l-green-500 border-t border-r border-b border-border/50",
          bg: "bg-white hover:bg-green-50/30",
          badge: "bg-green-100 text-green-700",
          icon: <ThumbsUp className="h-3.5 w-3.5" />,
          label: "RECOMMENDED"
        };
      default:
        return {
          border: "border-l-4 border-l-primary border-t border-r border-b border-border/50",
          bg: "bg-white hover:bg-primary/5",
          badge: "bg-primary/10 text-primary",
          icon: <Lightbulb className="h-3.5 w-3.5" />,
          label: "STRATEGY"
        };
    }
  };

  const styles = getTypeStyles();

  const handleClick = () => {
    if (!isLocked && onCardClick) {
      onCardClick(entry);
    }
  };

  // Check if we have actual blurred content from the backend (not just placeholder text)
  const hasBlurredContent = entry.quote &&
    !entry.quote.includes("[Content locked") &&
    !entry.quote.includes("[content locked") &&
    entry.quote.includes("****");

  // Locked card - show blurred content preview if available, otherwise show placeholder
  if (isLocked) {
    return (
      <article
        className={`
          relative overflow-hidden rounded-lg shadow-sm hover:shadow-md
          transition-all duration-200 cursor-pointer group
          ${styles.border} ${styles.bg}
        `}
      >
        <div className="p-5 flex flex-col h-full min-h-[200px]">
          {/* Header: Type badge + Lock indicator */}
          <div className="flex items-center justify-between mb-4">
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-bold tracking-wide ${styles.badge}`}>
              {styles.icon}
              {styles.label}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" />
              <span className="font-medium">Locked</span>
            </div>
          </div>

          {/* Blurred content preview - show actual content with vendor names masked as "****" */}
          {hasBlurredContent ? (
            <div className="flex-1 mb-4">
              {/* Title with blurred vendor names */}
              {entry.title && (
                <p className="text-sm font-medium text-foreground/80 mb-2 line-clamp-2">
                  {entry.title}
                </p>
              )}
              {/* Quote with blurred vendor names */}
              <div className="relative">
                <Quote className="absolute left-0 top-0 h-4 w-4 text-muted-foreground/30" />
                <p className="text-sm text-foreground/70 leading-relaxed line-clamp-3 pl-6">
                  "{entry.quote}"
                </p>
              </div>
              <p className="text-xs text-muted-foreground mt-3 italic">
                Upgrade to see which vendor this is about
              </p>
            </div>
          ) : (
            /* Fallback: placeholder blocks for cards without blurred content */
            <div className="flex-1 space-y-2 mb-4">
              <div className="h-5 w-3/4 bg-foreground/10 rounded blur-[3px]" />
              <div className="h-4 w-full bg-foreground/5 rounded blur-[2px]" />
              <div className="h-4 w-5/6 bg-foreground/5 rounded blur-[2px]" />
              <div className="h-4 w-2/3 bg-foreground/5 rounded blur-[2px]" />
            </div>
          )}

          {/* Centered CTA */}
          <div className="flex justify-center">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (isAuthenticated && onUpgradeClick) {
                  onUpgradeClick();
                } else {
                  const tiersSection = document.getElementById('tiers-section');
                  if (tiersSection) {
                    const offset = 100;
                    const elementPosition = tiersSection.getBoundingClientRect().top + window.pageYOffset;
                    window.scrollTo({ top: elementPosition - offset, behavior: 'smooth' });
                  }
                }
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-yellow-500 hover:bg-yellow-400 text-yellow-950 font-semibold text-sm shadow-lg hover:shadow-xl transition-all"
            >
              <Crown className="h-4 w-4" />
              <span>{isAuthenticated ? 'Unlock Vendor' : 'Join to Unlock'}</span>
            </button>
          </div>
        </div>
      </article>
    );
  }

  // Check if quote contains locked placeholder text from API
  const hasLockedPlaceholder = entry.quote.includes("[Content locked") ||
    entry.quote.includes("[content locked") ||
    entry.quote.includes("Join Pro to view") ||
    entry.quote.includes("Upgrade to Pro");

  // Unlocked card layout
  return (
    <article
      onClick={handleClick}
      className={`
        relative overflow-hidden rounded-lg shadow-sm hover:shadow-md
        transition-all duration-200 cursor-pointer group
        ${styles.border} ${styles.bg}
      `}
    >
      <div className="p-5">
        {/* Header: Type badge */}
        <div className="flex items-center justify-between mb-3">
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-bold tracking-wide ${styles.badge}`}>
            {styles.icon}
            {styles.label}
          </div>
        </div>

        {/* Vendor Name - Editorial style with logo */}
        {entry.vendorName && (
          <div className="mb-2 flex items-center gap-3">
            {/* Vendor Logo */}
            {vendorLogo && showVendorNames && (
              <Avatar className="h-10 w-10 border border-border shrink-0">
                <AvatarImage src={vendorLogo} alt={entry.vendorName} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                  {entry.vendorName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            )}
            <div className="flex-1 min-w-0">
              <h3
                className={`
                  text-lg font-bold text-foreground leading-tight inline
                  ${onVendorClick && showVendorNames ? "hover:text-primary transition-colors hover:underline cursor-pointer" : ""}
                `}
                onClick={(e) => {
                  if (onVendorClick && showVendorNames && entry.vendorName) {
                    e.stopPropagation();
                    onVendorClick(entry.vendorName);
                  }
                }}
              >
                {showVendorNames ? entry.vendorName : blurVendorNames(entry.vendorName)}
              </h3>
              {/* Verified vendor website link */}
              {vendorWebsite && showVendorNames && (
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
            {parseMarkdownWithBlur(entry.title, showVendorNames)}
          </p>
        )}

        {/* Quote - Handle locked placeholder gracefully */}
        <div className="relative">
          {hasLockedPlaceholder ? (
            <div className="py-4 px-4 rounded-lg bg-muted/50 border border-border/50 text-center">
              <Lock className="h-5 w-5 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground font-medium">
                Full review available to members
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Join to read what dealers are saying
              </p>
            </div>
          ) : (
            <>
              <Quote className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/30 mr-2" />
              <p className="text-sm text-foreground/80 leading-relaxed line-clamp-4 pl-6">
                "{renderQuote(entry.quote, showVendorNames)}"
              </p>
            </>
          )}
        </div>

        {/* Vendor Response Indicator */}
        {vendorResponse && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10">
            <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
              <ShieldCheck className="h-3 w-3" />
              <span>Vendor Response</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {vendorResponse.response_text}
            </p>
          </div>
        )}

        {/* Footer: Member attribution */}
        <div className="mt-4 pt-3 border-t border-border/50">
          <p className="text-xs text-muted-foreground">
            Circles Member{formatMemberDate(entry.createdAt) ? ` · ${formatMemberDate(entry.createdAt)}` : ''}
          </p>
        </div>
      </div>
    </article>
  );
};

export default VendorCard;
