import React from "react";
import ReactMarkdown from "react-markdown";
import { VendorMention } from "./VendorMention";
import { Lightbulb, CheckCircle, AlertTriangle } from "lucide-react";

interface ChatMarkdownProps {
  content: string;
  knownVendors?: string[];
}

// Common automotive vendor names to detect
const KNOWN_VENDOR_PATTERNS = [
  "CDK Global", "CDK", "Reynolds and Reynolds", "Reynolds", "Dealertrack",
  "Cox Automotive", "Tekion", "DealerSocket", "VinSolutions", "Elead",
  "AutoTrader", "Cars.com", "CarGurus", "TrueCar", "Edmunds",
  "RouteOne", "DealerBuilt", "Dealer.com", "DDC", "Sincro",
  "Autosoft", "PBS Systems", "Frazer", "Wayne Reaves", "Auto/Mate",
  "ProMax", "MaxDigital", "Darwin Automotive", "MenuVantage",
  "JM&A Group", "EasyCare", "Zurich", "Allstate", "Assurant",
  "Xtime", "DriveCentric", "Lotlinx", "PureCars", "Dealer Inspire",
  "Podium", "Birdeye", "Reputation.com", "Widewail", "Text2Drive",
  "CallRevu", "Car Wars", "Marchex", "Phone Ninjas",
  "CARFAX", "AutoCheck", "Kelley Blue Book", "KBB", "NADA Guides",
  "vAuto", "Provision", "StockWave", "HomeNet", "Homenet Automotive",
  "Digital Air Strike", "Stream Companies", "Naked Lime",
  "AutoAlert", "DealerMine", "Market Scan", "DealerTrack", "Dealer Track",
  "AutoFi", "Roadster", "Upstart", "Westlake Financial",
  "Modal", "Impel", "Conversica", "Gubagoo", "LivePerson",
  "Shift Digital", "Force Marketing", "Team Velocity", "Dealer eProcess"
];

/**
 * Renders markdown content with vendor names as clickable links
 * and visual hierarchy for recommendations vs reasoning
 */
export const ChatMarkdown: React.FC<ChatMarkdownProps> = ({
  content,
  knownVendors = [],
}) => {
  // Combine known vendors with additional ones from context
  const allVendors = [...new Set([...KNOWN_VENDOR_PATTERNS, ...knownVendors])];

  // Sort by length (longest first) to match longer names before shorter ones
  const sortedVendors = allVendors.sort((a, b) => b.length - a.length);

  // Build regex pattern for vendor detection
  const vendorPattern = new RegExp(
    `\\b(${sortedVendors.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
    'gi'
  );

  // Process text nodes to replace vendor names with links
  const processText = (text: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    // Create a new regex for each execution to reset lastIndex
    const regex = new RegExp(vendorPattern.source, 'gi');

    while ((match = regex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }

      // Find the canonical vendor name (case-preserved)
      const matchedText = match[1];
      const canonicalVendor = sortedVendors.find(
        v => v.toLowerCase() === matchedText.toLowerCase()
      ) || matchedText;

      // Add the vendor mention component
      parts.push(
        <VendorMention key={`${match.index}-${canonicalVendor}`} vendorName={canonicalVendor} />
      );

      lastIndex = regex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts.length > 0 ? <>{parts}</> : text;
  };

  // Process children recursively for vendor names
  const processChildren = (children: React.ReactNode): React.ReactNode => {
    return React.Children.map(children, (child) => {
      if (typeof child === "string") {
        return processText(child);
      }
      return child;
    });
  };

  // Detect if heading text contains recommendation/verdict keywords
  const isVerdictHeading = (text: string): boolean => {
    const lower = text.toLowerCase();
    return /\b(recommend|verdict|bottom line|takeaway|conclusion|winner|best|top pick|our pick|summary|key insight)/i.test(lower);
  };

  const isWarningHeading = (text: string): boolean => {
    const lower = text.toLowerCase();
    return /\b(warning|caution|watch out|red flag|concern|risk|downside|con)/i.test(lower);
  };

  // Extract plain text from children
  const getChildText = (children: React.ReactNode): string => {
    return React.Children.toArray(children)
      .map((child) => (typeof child === "string" ? child : ""))
      .join("");
  };

  return (
    <ReactMarkdown
      components={{
        // Paragraphs — the "reasoning" layer
        p: ({ children }) => (
          <p className="mb-2.5 last:mb-0 text-[13px] leading-relaxed text-foreground/75">
            {processChildren(children)}
          </p>
        ),

        // Headings — prominent section markers for key answers
        h1: ({ children }) => {
          const text = getChildText(children);
          const isVerdict = isVerdictHeading(text);
          const isWarning = isWarningHeading(text);
          return (
            <div className={`flex items-center gap-2 mt-4 mb-2 pb-1.5 border-b ${isWarning ? "border-red-200" : "border-amber-200/60"}`}>
              {isVerdict && <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />}
              {isWarning && <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />}
              <h2 className="text-[15px] font-bold text-foreground tracking-tight">{processChildren(children)}</h2>
            </div>
          );
        },
        h2: ({ children }) => {
          const text = getChildText(children);
          const isVerdict = isVerdictHeading(text);
          const isWarning = isWarningHeading(text);
          return (
            <div className={`flex items-center gap-2 mt-3.5 mb-2 pb-1 border-b ${isWarning ? "border-red-200" : "border-amber-200/60"}`}>
              {isVerdict && <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
              {isWarning && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
              <h3 className="text-[14px] font-bold text-foreground">{processChildren(children)}</h3>
            </div>
          );
        },
        h3: ({ children }) => (
          <h4 className="text-[13px] font-bold text-foreground mt-3 mb-1.5">
            {processChildren(children)}
          </h4>
        ),

        // Bold text — key findings, highlighted in foreground color
        strong: ({ children }) => (
          <strong className="font-semibold text-foreground">{processChildren(children)}</strong>
        ),

        // Blockquotes — callout cards for key takeaways / insights
        blockquote: ({ children }) => (
          <div className="my-3 px-3.5 py-2.5 rounded-xl bg-amber-50/80 border border-amber-200/50">
            <div className="flex gap-2">
              <Lightbulb className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-[13px] text-amber-900/80 leading-relaxed [&_p]:mb-1 [&_p:last-child]:mb-0 [&_p]:text-amber-900/80">
                {children}
              </div>
            </div>
          </div>
        ),

        // Lists — slightly elevated from paragraph text
        ul: ({ children }) => (
          <ul className="mb-2.5 space-y-1.5 pl-0">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-2.5 space-y-1.5 pl-0 list-none counter-reset-[item]">{children}</ol>
        ),
        li: ({ children, ...props }) => {
          // Check if inside an ordered list by looking for the `ordered` prop
          const isOrdered = (props as Record<string, unknown>).ordered;
          return (
            <li className="flex gap-2 text-[13px] leading-relaxed text-foreground/80">
              <span className={`shrink-0 mt-[3px] ${isOrdered ? "text-amber-500 font-semibold text-[12px] tabular-nums" : ""}`}>
                {isOrdered ? (
                  <>{(props as Record<string, unknown>).index as number + 1}.</>
                ) : (
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400 mt-[3px]" />
                )}
              </span>
              <span className="flex-1">{processChildren(children)}</span>
            </li>
          );
        },

        // Links
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-600 hover:text-amber-700 underline decoration-amber-300 underline-offset-2 hover:decoration-amber-500 transition-colors"
          >
            {children}
          </a>
        ),

        // Inline code
        code: ({ children }) => (
          <code className="px-1.5 py-0.5 rounded-md bg-foreground/[0.04] text-[12px] font-mono text-foreground/70">{children}</code>
        ),

        // Horizontal rules — section dividers
        hr: () => (
          <hr className="my-3 border-t border-foreground/[0.06]" />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
};

export default ChatMarkdown;
