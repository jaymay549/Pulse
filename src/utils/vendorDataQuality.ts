/**
 * Vendor Data Quality Validation Utility
 * 
 * Flags entries with summarized/analyzed language patterns before import,
 * identifies potential duplicates, and detects vendor name mismatches.
 */

// Patterns that indicate summarized/analyzed quotes rather than authentic dealer quotes
const SUMMARIZED_LANGUAGE_PATTERNS = [
  // Third-person descriptions instead of first-person quotes
  /^[A-Z][a-z]+ (provides|offers|delivers|is|was|has|reportedly|considered|described)/i,
  /^(A user|Users|Dealers|One dealer|Some) (reported|switched|are|noted|praised|experienced|encountered)/i,
  
  // Passive analysis language
  /(is reported|is considered|is praised|is described|was reported|was considered)/i,
  /(reportedly|allegedly|purportedly) (delivers|provides|offers|has)/i,
  /is widely considered/i,
  /is described as/i,
  
  // Summary phrases with quoted snippets embedded
  /provides ['"][\w\s]+['"] (service|training|support)/i,
  /considered ['"][\w\s]+['"] (and|for|with)/i,
  /described as ['"][\w\s]+['"]/i,
  
  // Analysis conclusions
  /(striking the right balance|coming 'highly recommended'|considered.*for)/i,
  /^(There|They|It) (is|are|was|were) (a|an|the|considered)/i,
  
  // Meta-commentary about the vendor rather than direct experience
  /(yielded|experienced|encounters?|achieves?|generates?) ['"][\w\s]+['"]/i,
];

// Phrases that strongly indicate authentic first-person dealer quotes
const AUTHENTIC_QUOTE_INDICATORS = [
  /^(We|I|Our|My) (use|have|switched|love|absolutely|highly|recently|just|tried|are|been)/i,
  /^(Looking|Have you|Does anyone|Anyone|Has anyone)/i,
  /for (us|me|our store|my store)/i,
  /(I would|I can|I'm|We're|We've|I've)/i,
  /(recommend|love it|happy with|switched to|been using)/i,
];

// Competitor pairs - if reviewing vendor A positively but mentioning B negatively, don't show in B's results
const COMPETITOR_PAIRS: Record<string, string[]> = {
  "tekion": ["cdk", "reynolds", "dealertrack"],
  "cdk": ["tekion", "reynolds", "dealertrack"],
  "reynolds": ["tekion", "cdk", "dealertrack"],
  "drivecentric": ["vinsolutions", "dealersocket", "eleads"],
  "vinsolutions": ["drivecentric", "dealersocket", "eleads"],
  "dealersocket": ["drivecentric", "vinsolutions", "eleads"],
  "purecars": ["team velocity", "dealer.com", "dealer inspire"],
  "team velocity": ["purecars", "dealer.com", "dealer inspire"],
  "autoalert": ["mastermind", "fullpath"],
  "mastermind": ["autoalert", "fullpath"],
  "dynatron": ["armatus"],
  "armatus": ["dynatron"],
  "callrevu": ["numa", "carwars"],
  "numa": ["callrevu", "carwars"],
  "carwars": ["callrevu", "numa"],
};

export interface DataQualityIssue {
  id: number;
  vendorName: string;
  title: string;
  issue: 'summarized_language' | 'potential_duplicate' | 'too_short' | 'no_quote_markers' | 'competitor_mismatch';
  severity: 'high' | 'medium' | 'low';
  details: string;
  quote: string;
  suggestedFix?: string;
}

export interface DuplicateGroup {
  vendorName: string;
  entries: Array<{
    id: number;
    title: string;
    quote: string;
    isAuthentic: boolean;
  }>;
}

/**
 * Check if a quote appears to be summarized/analyzed rather than authentic
 */
export function isSummarizedQuote(quote: string): { isSummarized: boolean; matchedPatterns: string[] } {
  const matchedPatterns: string[] = [];
  
  // Check for summarized language patterns
  for (const pattern of SUMMARIZED_LANGUAGE_PATTERNS) {
    if (pattern.test(quote)) {
      matchedPatterns.push(pattern.source);
    }
  }
  
  // Check for authentic indicators (these override summarized detection)
  let hasAuthenticIndicators = false;
  for (const pattern of AUTHENTIC_QUOTE_INDICATORS) {
    if (pattern.test(quote)) {
      hasAuthenticIndicators = true;
      break;
    }
  }
  
  // If it has authentic indicators, don't flag as summarized
  if (hasAuthenticIndicators && matchedPatterns.length < 2) {
    return { isSummarized: false, matchedPatterns: [] };
  }
  
  return {
    isSummarized: matchedPatterns.length > 0,
    matchedPatterns
  };
}

/**
 * Check if a quote is authentic based on first-person language
 */
export function isAuthenticQuote(quote: string): boolean {
  for (const pattern of AUTHENTIC_QUOTE_INDICATORS) {
    if (pattern.test(quote)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if title mentions competitors that would cause incorrect search results
 * Returns the competitor mentioned if this is a mismatch issue
 */
export function checkCompetitorMismatch(
  entry: { vendorName: string; title: string; quote: string; type: string }
): { hasMismatch: boolean; competitorMentioned?: string; suggestedTitle?: string } {
  const vendorLower = entry.vendorName.toLowerCase();
  const titleLower = entry.title.toLowerCase();
  
  // Get competitors for this vendor
  const competitors = COMPETITOR_PAIRS[vendorLower] || [];
  
  for (const competitor of competitors) {
    // If title mentions competitor AND this is a positive review for the main vendor
    // It will incorrectly show up in competitor's search results
    if (titleLower.includes(competitor) && entry.type === "positive") {
      // Suggest a title without competitor name
      const suggestedTitle = entry.title
        .replace(new RegExp(`\\s*(vs\\.?|versus|from|over|ahead of|better than)\\s*${competitor}`, 'gi'), '')
        .replace(new RegExp(`${competitor}\\s*(vs\\.?|versus|to|from)\\s*`, 'gi'), '')
        .replace(new RegExp(`:\\s*.*${competitor}.*$`, 'gi'), `: ${entry.vendorName} Excellence`)
        .trim();
      
      return {
        hasMismatch: true,
        competitorMentioned: competitor,
        suggestedTitle
      };
    }
  }
  
  return { hasMismatch: false };
}

/**
 * Find potential duplicates by comparing vendor names and similar quotes
 */
export function findDuplicates(entries: Array<{ id: number; vendorName: string; title: string; quote: string }>): DuplicateGroup[] {
  const vendorMap = new Map<string, typeof entries>();
  
  // Group by vendor name (normalized)
  for (const entry of entries) {
    const normalizedName = entry.vendorName.toLowerCase().trim();
    const existing = vendorMap.get(normalizedName) || [];
    existing.push(entry);
    vendorMap.set(normalizedName, existing);
  }
  
  // Find vendors with multiple entries that might be duplicates
  const duplicates: DuplicateGroup[] = [];
  
  for (const [vendorName, vendorEntries] of vendorMap) {
    if (vendorEntries.length > 1) {
      // Check for quote similarity
      const entriesWithAuth = vendorEntries.map(e => ({
        ...e,
        isAuthentic: isAuthenticQuote(e.quote)
      }));
      
      // Check if any quotes are very similar (potential duplicates)
      const hasSimilarQuotes = checkForSimilarQuotes(entriesWithAuth.map(e => e.quote));
      
      if (hasSimilarQuotes) {
        duplicates.push({
          vendorName,
          entries: entriesWithAuth
        });
      }
    }
  }
  
  return duplicates;
}

/**
 * Check if any quotes in the array are similar enough to be duplicates
 */
function checkForSimilarQuotes(quotes: string[]): boolean {
  for (let i = 0; i < quotes.length; i++) {
    for (let j = i + 1; j < quotes.length; j++) {
      const similarity = calculateSimilarity(quotes[i], quotes[j]);
      if (similarity > 0.6) { // 60% similarity threshold
        return true;
      }
    }
  }
  return false;
}

/**
 * Simple Jaccard similarity for quote comparison
 */
function calculateSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const words2 = new Set(str2.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

/**
 * Validate an array of vendor entries and return quality issues
 */
export function validateVendorData(entries: Array<{ id: number; vendorName: string; title: string; quote: string; type?: string }>): DataQualityIssue[] {
  const issues: DataQualityIssue[] = [];
  
  for (const entry of entries) {
    // Check for summarized language
    const { isSummarized, matchedPatterns } = isSummarizedQuote(entry.quote);
    if (isSummarized) {
      issues.push({
        id: entry.id,
        vendorName: entry.vendorName,
        title: entry.title,
        issue: 'summarized_language',
        severity: 'high',
        details: `Quote appears to be summarized/analyzed rather than authentic. Matched patterns: ${matchedPatterns.slice(0, 2).join(', ')}`,
        quote: entry.quote.substring(0, 100) + '...'
      });
    }
    
    // Check for competitor mismatches in title
    const mismatchCheck = checkCompetitorMismatch({ 
      vendorName: entry.vendorName, 
      title: entry.title, 
      quote: entry.quote,
      type: entry.type || 'positive'
    });
    if (mismatchCheck.hasMismatch) {
      issues.push({
        id: entry.id,
        vendorName: entry.vendorName,
        title: entry.title,
        issue: 'competitor_mismatch',
        severity: 'high',
        details: `Title mentions competitor "${mismatchCheck.competitorMentioned}" - this positive review will incorrectly show up in ${mismatchCheck.competitorMentioned}'s search results`,
        quote: entry.quote.substring(0, 100) + '...',
        suggestedFix: `Change title to: "${mismatchCheck.suggestedTitle}"`
      });
    }
    
    // Check for too-short quotes
    if (entry.quote.length < 30) {
      issues.push({
        id: entry.id,
        vendorName: entry.vendorName,
        title: entry.title,
        issue: 'too_short',
        severity: 'medium',
        details: 'Quote is very short and may lack meaningful dealer insight',
        quote: entry.quote
      });
    }
  }
  
  // Check for duplicates
  const duplicateGroups = findDuplicates(entries);
  for (const group of duplicateGroups) {
    // Flag non-authentic duplicates for removal
    const nonAuthenticEntries = group.entries.filter(e => !e.isAuthentic);
    for (const entry of nonAuthenticEntries) {
      issues.push({
        id: entry.id,
        vendorName: group.vendorName,
        title: entry.title,
        issue: 'potential_duplicate',
        severity: 'high',
        details: `Potential duplicate with summarized language. Vendor has ${group.entries.length} entries - prefer authentic quotes.`,
        quote: entry.quote.substring(0, 100) + '...'
      });
    }
  }
  
  return issues;
}

/**
 * Get IDs of entries that should be removed (summarized duplicates)
 */
export function getIdsToRemove(entries: Array<{ id: number; vendorName: string; title: string; quote: string }>): number[] {
  const issues = validateVendorData(entries);
  const summarizedDuplicateIds = new Set<number>();
  
  // Get all duplicate groups
  const duplicateGroups = findDuplicates(entries);
  
  for (const group of duplicateGroups) {
    // If there are authentic entries, remove the non-authentic ones
    const authenticEntries = group.entries.filter(e => e.isAuthentic);
    const nonAuthenticEntries = group.entries.filter(e => !e.isAuthentic);
    
    if (authenticEntries.length > 0 && nonAuthenticEntries.length > 0) {
      // Keep authentic, remove non-authentic
      for (const entry of nonAuthenticEntries) {
        summarizedDuplicateIds.add(entry.id);
      }
    }
  }
  
  return Array.from(summarizedDuplicateIds);
}

/**
 * Run a full audit and return a summary report
 */
export function runDataQualityAudit(entries: Array<{ id: number; vendorName: string; title: string; quote: string; type?: string }>): {
  totalEntries: number;
  issueCount: number;
  issuesByType: Record<string, number>;
  issues: DataQualityIssue[];
} {
  const issues = validateVendorData(entries);
  
  const issuesByType: Record<string, number> = {};
  for (const issue of issues) {
    issuesByType[issue.issue] = (issuesByType[issue.issue] || 0) + 1;
  }
  
  return {
    totalEntries: entries.length,
    issueCount: issues.length,
    issuesByType,
    issues
  };
}

// Export for testing
export const PATTERNS = {
  summarized: SUMMARIZED_LANGUAGE_PATTERNS,
  authentic: AUTHENTIC_QUOTE_INDICATORS,
  competitors: COMPETITOR_PAIRS
};
