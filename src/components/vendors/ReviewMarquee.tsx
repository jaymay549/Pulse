import { AlertTriangle, ThumbsUp, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Curated enticing reviews - mix of wins with warnings every 3rd card
const reviewsCarousel = [
  {
    type: "positive" as const,
    vendor: "TruVideo",
    category: "Fixed Ops",
    quote: "Customer pay hours up 22% in 90 days. Video walkarounds changed everything for us.",
    role: "Service Director",
  },
  {
    type: "positive" as const,
    vendor: "Podium",
    category: "Communication",
    quote: "Went from 3.2 to 4.7 stars in 6 months. The text-to-pay feature alone is worth it.",
    role: "GM",
  },
  {
    type: "warning" as const,
    vendor: "████████",
    category: "DMS & CRM",
    quote: "Contract auto-renewed for 3 years without proper notice. Legal fees to exit were $40K+.",
    role: "Dealer Principal",
  },
  {
    type: "positive" as const,
    vendor: "Rapid Recon",
    category: "Reconditioning",
    quote: "Cut recon time from 8 days to 3. That's $200+ per car in holding costs saved.",
    role: "Pre-Owned Director",
  },
  {
    type: "positive" as const,
    vendor: "CarGurus",
    category: "Marketplace",
    quote: "Best lead quality of any third-party. Our close rate on CG leads is 2x higher than others.",
    role: "Internet Director",
  },
  {
    type: "warning" as const,
    vendor: "████████",
    category: "Marketing",
    quote: "Claimed 300 leads/month. Actual attributable sales? 12. Inflated reporting cost us $180K.",
    role: "Marketing Director",
  },
  {
    type: "positive" as const,
    vendor: "DriveCentric",
    category: "CRM",
    quote: "Finally a CRM our salespeople actually use. Training took 2 days, not 2 months.",
    role: "Sales Manager",
  },
  {
    type: "positive" as const,
    vendor: "Reynolds & Reynolds",
    category: "DMS",
    quote: "Rock solid. Been on ERA for 12 years. Support response time is unmatched.",
    role: "Controller",
  },
  {
    type: "warning" as const,
    vendor: "████████",
    category: "AI & Automation",
    quote: "Implementation took 6 months instead of 6 weeks. Support was non-existent.",
    role: "Fixed Ops Director",
  },
  {
    type: "positive" as const,
    vendor: "STELLA AI",
    category: "AI & Automation",
    quote: "Handles 40% of our service calls now. Customers can't tell it's AI. Game changer.",
    role: "BDC Director",
  },
];

export const ReviewMarquee = () => {
  // Double the array for seamless loop
  const doubledReviews = [...reviewsCarousel, ...reviewsCarousel];

  return (
    <div className="relative mb-8">
      {/* Gradient Fades */}
      <div className="absolute left-0 top-0 bottom-0 w-16 sm:w-24 bg-gradient-to-r from-[hsl(var(--vendor-bg))] to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-16 sm:w-24 bg-gradient-to-l from-[hsl(var(--vendor-bg))] to-transparent z-10 pointer-events-none" />
      
      {/* Scrolling Container */}
      <div className="overflow-hidden">
        <div 
          className="flex gap-4 hover:pause-animation"
          style={{
            width: 'max-content',
            animation: 'marquee 90s linear infinite',
          }}
        >
          {doubledReviews.map((review, i) => (
            <div
              key={i}
              className={`flex-shrink-0 w-[300px] sm:w-[340px] p-4 sm:p-5 rounded-xl border-2 transition-transform hover:scale-[1.02] ${
                review.type === 'warning'
                  ? 'bg-red-500/5 border-red-500/30'
                  : 'bg-green-500/5 border-green-500/30'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-full shrink-0 ${
                  review.type === 'warning' ? 'bg-red-500/20' : 'bg-green-500/20'
                }`}>
                  {review.type === 'warning' ? (
                    <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
                  ) : (
                    <ThumbsUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {review.type === 'warning' ? (
                      <span className="font-bold text-foreground blur-[4px] select-none text-sm sm:text-base">{review.vendor}</span>
                    ) : (
                      <span className="font-bold text-foreground text-sm sm:text-base">{review.vendor}</span>
                    )}
                    <Badge variant="outline" className="text-xs">{review.category}</Badge>
                    {review.type === 'warning' && (
                      <Lock className="h-3 w-3 text-muted-foreground ml-auto" />
                    )}
                  </div>
                  <blockquote className="text-xs sm:text-sm text-muted-foreground italic leading-relaxed line-clamp-3">
                    "{review.quote}"
                  </blockquote>
                  <p className="text-xs text-muted-foreground mt-2 font-medium">
                    — {review.role}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Marquee Animation Keyframes */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .hover\\:pause-animation:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
};

export default ReviewMarquee;
