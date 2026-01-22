import React from "react";

/**
 * Parses markdown syntax into React elements
 * Supports:
 * - **text** for bold
 * - ****text**** for bold (handles four asterisks)
 * - *text* for italic (only if not part of ** or ****)
 */
export function parseMarkdown(text: string): React.ReactNode {
  if (!text) return text;
  
  const parts: React.ReactNode[] = [];
  let remainingText = text;
  let keyIndex = 0;

  // Process text sequentially, matching patterns from longest to shortest
  while (remainingText.length > 0) {
    // Try to match ****text**** first (four asterisks - treat as bold)
    if (remainingText.startsWith("****")) {
      const fourStarMatch = remainingText.match(/^\*\*\*\*(.+?)\*\*\*\*/);
      if (fourStarMatch) {
        parts.push(
          <strong key={keyIndex++} className="font-semibold">
            {fourStarMatch[1]}
          </strong>
        );
        remainingText = remainingText.slice(fourStarMatch[0].length);
        continue;
      } else {
        // **** without closing, treat first * as literal and continue
        parts.push(remainingText[0]);
        remainingText = remainingText.slice(1);
        continue;
      }
    }
    
    // Try to match **text** (two asterisks - bold)
    if (remainingText.startsWith("**")) {
      const twoStarMatch = remainingText.match(/^\*\*(.+?)\*\*/);
      if (twoStarMatch) {
        parts.push(
          <strong key={keyIndex++} className="font-semibold">
            {twoStarMatch[1]}
          </strong>
        );
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
          </em>
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
