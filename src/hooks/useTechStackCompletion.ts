import type { TechStackEntry } from "./useTechStackProfile";

export interface TechStackCompletion {
  percentage: number;
  isComplete: boolean;
  missing: string[];
}

/**
 * Modern completion logic for the Tactile Stack Builder:
 * 1. Every category must either have a vendor OR be explicitly skipped (N/A)
 * 2. All added vendors must have a sentiment rating (mandatory)
 * 3. All exploring/left vendors must have at least one reason category (mandatory)
 */
export function computeTechStackCompletion(
  entries: TechStackEntry[],
  skippedCategories: string[] = []
): TechStackCompletion {
  const missing: string[] = [];
  const CATEGORIES = ["CRM", "DMS", "Website", "Appraisal", "Fixed Ops", "AI", "Inventory"]; // Core categories

  // 1. Check core categories
  for (const cat of CATEGORIES) {
    const hasVendor = entries.some(e => e.category === cat && e.is_current);
    const isSkipped = skippedCategories.includes(cat);
    
    if (!hasVendor && !isSkipped) {
      missing.push(`Add ${cat} or mark as N/A`);
    }
  }

  // 2. All vendors have sentiment scores
  const unrated = entries.filter((e) => e.sentiment_score === null);
  if (unrated.length > 0) {
    missing.push(`Rate ${unrated[0].vendor_name}`);
  }

  // 3. All exploring/left have reasons
  const needReasons = entries.filter(
    (e) => e.status === "exploring" || e.status === "left"
  );
  const missingReasons = needReasons.filter((e) => e.exit_reasons.length === 0);

  if (missingReasons.length > 0) {
    missing.push(`Add reasons for ${missingReasons[0].vendor_name}`);
  }

  // Calculate percentage
  const totalSteps = CATEGORIES.length + entries.length + needReasons.length;
  const completedSteps = 
    CATEGORIES.filter(cat => entries.some(e => e.category === cat && e.is_current) || skippedCategories.includes(cat)).length +
    entries.filter(e => e.sentiment_score !== null).length +
    needReasons.filter(e => e.exit_reasons.length > 0).length;

  const percentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return {
    percentage,
    isComplete: missing.length === 0,
    missing,
  };
}
