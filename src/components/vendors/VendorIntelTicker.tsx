import { AlertTriangle, ThumbsUp, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface IntelCardData {
  type: "warning" | "recommended";
  category: string;
  excerpt: string;
  blurred?: boolean;
}

const CARDS: IntelCardData[] = [
  {
    type: "warning",
    category: "DMS & CRM",
    excerpt: "Be very careful with contracts. They auto-renewed us for 3 years without proper notice. Exit fees were brutal.",
  },
  {
    type: "recommended",
    category: "Equity Mining",
    excerpt: "Increased our service-to-sales conversions by 340% in the first quarter. ROI was immediate and measurable.",
  },
  {
    type: "warning",
    category: "Digital Marketing",
    excerpt: "The reporting was inflated. Actual attribution was 40% of what they claimed when we audited the data.",
    blurred: true,
  },
  {
    type: "recommended",
    category: "F&I Platform",
    excerpt: "Best F&I tool we've used in 12 years. Support actually picks up the phone and knows the product cold.",
  },
  {
    type: "warning",
    category: "Inventory Mgmt",
    excerpt: "Watch the data fees — they're buried in the contract and added up to $800/month we hadn't budgeted for.",
    blurred: true,
  },
  {
    type: "recommended",
    category: "BDC Tools",
    excerpt: "Lead response times dropped from 4 hours to under 8 minutes. Show rate jumped from 52% to 71%.",
  },
  {
    type: "warning",
    category: "SEO / Advertising",
    excerpt: "Promised zip code exclusivity but we found three competitors in our market on the same platform.",
    blurred: true,
  },
  {
    type: "recommended",
    category: "Desking",
    excerpt: "Eliminated back-and-forth between sales and F&I. Pencil to signed in under 22 minutes on average.",
  },
  {
    type: "warning",
    category: "Video / OTT",
    excerpt: "Sold us on impression volume — couldn't show a single attributable sale after 6 months of spend.",
    blurred: true,
  },
  {
    type: "recommended",
    category: "Service Scheduling",
    excerpt: "Online scheduling went from 12% to 61% of all service appointments in 90 days. Game changer.",
  },
];

function IntelCard({ card }: { card: IntelCardData }) {
  const isWarning = card.type === "warning";
  return (
    <div
      className={cn(
        "relative w-72 shrink-0 rounded-xl border-2 p-4",
        isWarning
          ? "border-red-200 bg-red-50"
          : "border-green-200 bg-green-50"
      )}
    >
      {/* Badge + category */}
      <div className="flex items-center gap-2 mb-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide",
            isWarning
              ? "bg-red-100 text-red-700"
              : "bg-green-100 text-green-700"
          )}
        >
          {isWarning ? (
            <AlertTriangle className="h-3 w-3" />
          ) : (
            <ThumbsUp className="h-3 w-3" />
          )}
          {isWarning ? "Warning" : "Recommended"}
        </span>
        <span className="text-xs text-muted-foreground font-medium truncate">
          {card.category}
        </span>
      </div>

      {/* Excerpt */}
      <div className="relative">
        <p
          className={cn(
            "text-sm text-foreground/80 leading-relaxed",
            card.blurred && "blur-sm select-none"
          )}
        >
          "{card.excerpt}"
        </p>
        {card.blurred && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-1.5 bg-white/90 backdrop-blur-sm border border-border rounded-lg px-3 py-1.5 shadow-sm">
              <Lock className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs font-semibold text-foreground">
                Members only
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface VendorIntelTickerProps {
  totalReviews?: number;
  totalWarnings?: number;
  totalRecommendations?: number;
  className?: string;
}

export function VendorIntelTicker({
  totalReviews,
  totalWarnings,
  totalRecommendations,
  className,
}: VendorIntelTickerProps) {
  const row1 = [...CARDS, ...CARDS];
  const row2 = [...CARDS.slice(5), ...CARDS.slice(0, 5), ...CARDS.slice(5), ...CARDS.slice(0, 5)];

  return (
    <section className={cn("overflow-hidden", className)}>
      <style>{`
        @keyframes ticker-left {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes ticker-right {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
        .ticker-row-left {
          animation: ticker-left 45s linear infinite;
        }
        .ticker-row-right {
          animation: ticker-right 50s linear infinite;
        }
        .ticker-row-left:hover,
        .ticker-row-right:hover {
          animation-play-state: paused;
        }
      `}</style>

      {/* Header */}
      <div className="text-center mb-8 px-4">
        <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-2">
          From CDG Circles Members
        </p>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
          Raw Vendor Intel You Won't Find Anywhere Else
        </h2>
        <div className="flex items-center justify-center gap-4 mt-4 text-sm text-muted-foreground flex-wrap">
          {totalReviews !== undefined && (
            <span>
              <strong className="text-foreground">{totalReviews.toLocaleString()}+</strong> reviews
            </span>
          )}
          {totalWarnings !== undefined && (
            <>
              <span className="text-border hidden sm:inline">•</span>
              <span>
                <strong className="text-red-600">{totalWarnings.toLocaleString()}+</strong> warnings
              </span>
            </>
          )}
          {totalRecommendations !== undefined && (
            <>
              <span className="text-border hidden sm:inline">•</span>
              <span>
                <strong className="text-green-600">{totalRecommendations.toLocaleString()}+</strong> recommendations
              </span>
            </>
          )}
        </div>
      </div>

      {/* Row 1 — scrolls left */}
      <div className="flex gap-4 mb-4 w-max ticker-row-left">
        {row1.map((card, i) => (
          <IntelCard key={`r1-${i}`} card={card} />
        ))}
      </div>

      {/* Row 2 — scrolls right */}
      <div className="flex gap-4 w-max ticker-row-right">
        {row2.map((card, i) => (
          <IntelCard key={`r2-${i}`} card={card} />
        ))}
      </div>

      {/* CTA */}
      <div className="text-center mt-10 px-4">
        <p className="text-sm text-muted-foreground mb-4">
          This intel is exclusive to CDG Circles members.
        </p>
        <Button variant="yellow" size="lg" className="font-bold" asChild>
          <a
            href="https://cdgcircles.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            Join CDG Circles to Unlock All Intel
          </a>
        </Button>
      </div>
    </section>
  );
}
