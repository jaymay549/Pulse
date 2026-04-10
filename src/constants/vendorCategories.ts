/**
 * Single source of truth for vendor categories.
 * Used by: frontend filters, AI enrichment (enrich-mentions), vendor-enrich edge function.
 *
 * When adding/removing a category, update this file and redeploy the edge functions.
 */

export interface VendorCategory {
  id: string;
  label: string;
  icon: string;
  /** Short description used in AI prompts to help classify correctly */
  aiHint: string;
}

export const VENDOR_CATEGORIES: VendorCategory[] = [
  { id: "dms", label: "DMS", icon: "\uD83D\uDCBB", aiHint: "Dealer Management Systems — back-office operations (CDK, Reynolds, Tekion, PBS, Frazer)" },
  { id: "crm", label: "CRM", icon: "\uD83D\uDC65", aiHint: "Customer Relationship Management — sales/lead management (DriveCentric, VinSolutions, Elead)" },
  { id: "inventory", label: "Inventory", icon: "\uD83D\uDCE6", aiHint: "Inventory management, pricing, appraisal tools (vAuto, VinCue, Accu-Trade)" },
  { id: "marketing", label: "Marketing & Ads", icon: "\uD83D\uDCE3", aiHint: "Digital advertising, SEO, SEM, social media marketing" },
  { id: "website", label: "Website Providers", icon: "\uD83C\uDF10", aiHint: "Dealership website platforms and providers (Dealer Inspire, DealerOn, Dealer.com)" },
  { id: "digital-retailing", label: "Digital Retailing", icon: "\uD83D\uDED2", aiHint: "Online buying/selling tools for consumers (Roadster, Darwin, Gubagoo)" },
  { id: "fixed-ops", label: "Fixed Ops", icon: "\uD83D\uDD27", aiHint: "Service, parts, recalls, repair orders — service department tools" },
  { id: "ai-automation", label: "AI & Automation", icon: "\uD83E\uDD16", aiHint: "AI chatbots, automation, virtual assistants (Impel, Numa, Matador)" },
  { id: "f-and-i", label: "F&I", icon: "\uD83D\uDCB0", aiHint: "Finance & Insurance products, menu selling, compliance tools" },
  { id: "equity-mining", label: "Equity Mining", icon: "\uD83D\uDC8E", aiHint: "Data mining for trade equity opportunities and customer retention" },
  { id: "desking", label: "Desking", icon: "\uD83D\uDDA5\uFE0F", aiHint: "Deal structuring, desking, and penciling tools" },
  { id: "call-management", label: "Call Management", icon: "\uD83D\uDCF1", aiHint: "Phone tracking, call analytics, call recording (CallRevu, Car Wars)" },
  { id: "lead-providers", label: "Lead Providers", icon: "\uD83D\uDCDE", aiHint: "Third-party lead generation and lead aggregators" },
  { id: "reputation", label: "Reputation", icon: "\u2B50", aiHint: "Reviews, reputation management, customer feedback (Podium, Birdeye)" },
  { id: "training", label: "Training", icon: "\uD83C\uDF93", aiHint: "Training, consulting, 20-groups, coaching (NCM, Chris Collins)" },
  { id: "recon", label: "Reconditioning", icon: "\uD83D\uDE97", aiHint: "Vehicle reconditioning workflow and tracking" },
  { id: "accounting", label: "Accounting", icon: "\uD83D\uDCCA", aiHint: "Dealership accounting and financial reporting software" },
  { id: "hr-payroll", label: "HR & Payroll", icon: "\uD83D\uDC65", aiHint: "Human resources, payroll, and employee management" },
  { id: "compliance", label: "Compliance", icon: "\uD83D\uDCCB", aiHint: "Regulatory compliance, OFAC, Red Flags, deal auditing" },
  { id: "service-products", label: "Service Products", icon: "\uD83E\uDDF4", aiHint: "Aftermarket service contracts, warranties, protection products" },
  { id: "security", label: "Security & Tracking", icon: "\uD83D\uDD10", aiHint: "Vehicle tracking, lot management, security systems" },
  { id: "diagnostics", label: "Diagnostics", icon: "\uD83D\uDD0D", aiHint: "Vehicle diagnostics and inspection tools" },
  { id: "it-support", label: "IT Support", icon: "\uD83D\uDDA5\uFE0F", aiHint: "IT infrastructure, managed services, cybersecurity for dealerships" },
];

/** Just the category IDs — useful for validation */
export const VALID_CATEGORY_IDS = VENDOR_CATEGORIES.map((c) => c.id);

/** Formatted string for AI prompts listing all categories with hints */
export function getCategoryPromptList(): string {
  return VENDOR_CATEGORIES.map((c) => `"${c.id}" — ${c.aiHint}`).join("\n");
}
