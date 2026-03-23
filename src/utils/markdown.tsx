import React from "react";
import { VendorMention } from "@/components/vendors/VendorMention";

export interface ParseMarkdownOptions {
  linkifyVendors?: boolean;
  knownVendors?: string[];
  vendorMentionClassName?: string;
  vendorMentionShowLogo?: boolean;
}

/** Options for linkifying vendor mentions in review text (inline chip style) */
export const REVIEW_LINKIFY_OPTIONS: Omit<
  ParseMarkdownOptions,
  "knownVendors"
> = {
  linkifyVendors: true,
  vendorMentionShowLogo: false,
  vendorMentionClassName:
    "px-1 py-0 rounded bg-primary/10 hover:bg-primary/20 text-primary text-[0.92em] align-baseline no-underline",
};

/**
 * Replaces vendor names with chips within already-bold markdown segments.
 * This avoids guessing from arbitrary text and uses server-provided emphasis.
 */
let _mentionKeyCounter = 0;

function processBoldTextWithVendorMentions(
  text: string,
  knownVendors: string[] = [],
  vendorMentionClassName?: string,
  vendorMentionShowLogo: boolean = true,
): React.ReactNode | null {
  if (!text || knownVendors.length === 0) return null;

  const uniqueKnownVendors = [...new Set(knownVendors.filter(Boolean))];
  if (uniqueKnownVendors.length === 0) return null;

  const sortedVendors = uniqueKnownVendors.sort((a, b) => b.length - a.length);
  const vendorPattern = new RegExp(
    `\\b(${sortedVendors.map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
    "gi",
  );

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  const regex = new RegExp(vendorPattern.source, "gi");
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const matchedText = match[1];
    const canonicalVendor =
      sortedVendors.find(
        (v) => v.toLowerCase() === matchedText.toLowerCase(),
      ) || matchedText;
    parts.push(
      <VendorMention
        key={`vm-${_mentionKeyCounter++}`}
        vendorName={canonicalVendor}
        className={vendorMentionClassName}
        showLogo={vendorMentionShowLogo}
      />,
    );
    lastIndex = regex.lastIndex;
  }

  if (parts.length === 0) return null;
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return <>{parts}</>;
}

/**
 * Some API responses wrap vendor mentions in [brackets] instead of markdown bold.
 * Normalize those markers to bold so mention chips render consistently.
 */
function normalizeBracketedVendorMentions(
  text: string,
  knownVendors: string[] = [],
): string {
  if (!text || knownVendors.length === 0) return text;

  const uniqueKnownVendors = [...new Set(knownVendors.filter(Boolean))];
  if (uniqueKnownVendors.length === 0) return text;

  const sortedVendors = uniqueKnownVendors.sort((a, b) => b.length - a.length);
  const vendorRegexSource = `\\b(${sortedVendors
    .map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|")})\\b`;

  return text.replace(/\[\s*([^\]]+?)\s*\]/g, (_full, rawInner: string) => {
    const inner = rawInner.trim();
    const hasKnownVendor = new RegExp(vendorRegexSource, "i").test(inner);
    if (!hasKnownVendor) return _full;

    return inner.replace(new RegExp(vendorRegexSource, "gi"), (matchedText) => {
      const canonicalVendor =
        sortedVendors.find((v) => v.toLowerCase() === matchedText.toLowerCase()) ||
        matchedText;
      return `**${canonicalVendor}**`;
    });
  });
}

/**
 * Parses markdown syntax into React elements
 * Supports:
 * - **text** for bold
 * - ****text**** for bold (handles four asterisks)
 * - ***text*** for bold italic (handles three asterisks)
 * - *text* for italic (only if not part of ** or ****)
 * - linkifyVendors: when true, vendor names become clickable chips linking to vendor pages
 */
export function parseMarkdown(
  text: string,
  options?: ParseMarkdownOptions,
): React.ReactNode {
  const {
    linkifyVendors = false,
    knownVendors = [],
    vendorMentionClassName,
    vendorMentionShowLogo = true,
  } = options ?? {};
  if (!text) return text;

  const normalizedText =
    linkifyVendors && knownVendors.length > 0
      ? normalizeBracketedVendorMentions(text, knownVendors)
      : text;

  const renderBoldSegment = (segmentText: string, key: number) => {
    if (linkifyVendors) {
      const linked = processBoldTextWithVendorMentions(
        segmentText,
        knownVendors,
        vendorMentionClassName,
        vendorMentionShowLogo,
      );
      if (linked) return <React.Fragment key={key}>{linked}</React.Fragment>;
    }
    return (
      <strong key={key} className="font-semibold">
        {segmentText}
      </strong>
    );
  };

  const parts: React.ReactNode[] = [];
  let remainingText = normalizedText;
  let keyIndex = 0;

  // Process text sequentially, matching patterns from longest to shortest
  while (remainingText.length > 0) {
    // Try to match ****text**** first (four asterisks - treat as bold)
    if (remainingText.startsWith("****")) {
      const fourStarMatch = remainingText.match(/^\*\*\*\*(.+?)\*\*\*\*/);
      if (fourStarMatch) {
        parts.push(renderBoldSegment(fourStarMatch[1], keyIndex++));
        remainingText = remainingText.slice(fourStarMatch[0].length);
        continue;
      } else {
        // **** without closing, treat first * as literal and continue
        parts.push(remainingText[0]);
        remainingText = remainingText.slice(1);
        continue;
      }
    }

    // Try to match ***text*** (three asterisks - bold italic)
    if (remainingText.startsWith("***")) {
      const threeStarMatch = remainingText.match(/^\*\*\*(.+?)\*\*\*/);
      if (threeStarMatch) {
        const innerText = threeStarMatch[1];
        if (linkifyVendors) {
          const linked = processBoldTextWithVendorMentions(
            innerText,
            knownVendors,
            vendorMentionClassName,
            vendorMentionShowLogo,
          );
          if (linked) {
            parts.push(<React.Fragment key={keyIndex++}>{linked}</React.Fragment>);
            remainingText = remainingText.slice(threeStarMatch[0].length);
            continue;
          }
        }
        parts.push(
          <strong key={keyIndex++} className="font-semibold italic">
            {innerText}
          </strong>,
        );
        remainingText = remainingText.slice(threeStarMatch[0].length);
        continue;
      } else {
        // *** without closing, treat first * as literal and continue
        parts.push(remainingText[0]);
        remainingText = remainingText.slice(1);
        continue;
      }
    }

    // Try to match **text** (two asterisks - bold)
    if (remainingText.startsWith("**")) {
      const twoStarMatch = remainingText.match(/^\*\*(.+?)\*\*/);
      if (twoStarMatch) {
        parts.push(renderBoldSegment(twoStarMatch[1], keyIndex++));
        remainingText = remainingText.slice(twoStarMatch[0].length);
        continue;
      } else {
        // ** without closing, treat first * as literal and continue
        parts.push(remainingText[0]);
        remainingText = remainingText.slice(1);
        continue;
      }
    }

    // Try to match *text* (single asterisk - italic)
    if (remainingText.startsWith("*")) {
      const singleStarMatch = remainingText.match(/^\*(.+?)\*/);
      if (singleStarMatch) {
        parts.push(
          <em key={keyIndex++} className="italic">
            {singleStarMatch[1]}
          </em>,
        );
        remainingText = remainingText.slice(singleStarMatch[0].length);
        continue;
      } else {
        // * without closing, treat as literal and continue
        parts.push(remainingText[0]);
        remainingText = remainingText.slice(1);
        continue;
      }
    }

    // No markdown pattern found, find the next asterisk or add remaining text
    const nextStar = remainingText.indexOf("*");
    if (nextStar === -1) {
      // No more asterisks, add remaining text
      parts.push(remainingText);
      break;
    } else {
      // Add text before the asterisk
      if (nextStar > 0) {
        parts.push(remainingText.slice(0, nextStar));
      }
      remainingText = remainingText.slice(nextStar);
    }
  }

  return parts.length > 0 ? parts : text;
}
