import React from "react";
import ReactMarkdown from "react-markdown";
import { VendorMention } from "./VendorMention";

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
    let match;
    
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

  return (
    <ReactMarkdown
      components={{
        // Override paragraph to process vendor names
        p: ({ children }) => {
          const processed = React.Children.map(children, (child) => {
            if (typeof child === "string") {
              return processText(child);
            }
            return child;
          });
          return <p className="mb-2 last:mb-0">{processed}</p>;
        },
        // Override list items
        li: ({ children }) => {
          const processed = React.Children.map(children, (child) => {
            if (typeof child === "string") {
              return processText(child);
            }
            return child;
          });
          return <li className="mb-1">{processed}</li>;
        },
        // Style other elements
        strong: ({ children }) => {
          const processed = React.Children.map(children, (child) => {
            if (typeof child === "string") {
              return processText(child);
            }
            return child;
          });
          return <strong className="font-semibold">{processed}</strong>;
        },
        ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
        h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
        h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">
            {children}
          </a>
        ),
        code: ({ children }) => (
          <code className="px-1 py-0.5 rounded bg-muted text-sm font-mono">{children}</code>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
};

export default ChatMarkdown;
