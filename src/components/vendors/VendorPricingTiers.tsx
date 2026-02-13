import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Eye, ArrowRight, ShieldCheck, MessageSquare, BarChart3, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
interface VendorPricingTiersProps {
  totalReviews: number;
  totalWarnings: number;
  onSignInClick?: () => void;
}

export const VendorPricingTiers: React.FC<VendorPricingTiersProps> = ({
  totalReviews,
  totalWarnings,
  onSignInClick,
}) => {
  const [isAnnual, setIsAnnual] = useState(false);
  const [isVerifiedAnnual, setIsVerifiedAnnual] = useState(false);

  const viewerPricing = {
    monthly: {
      price: "$299",
      period: "/mo",
      link: import.meta.env.VITE_STRIPE_CHECKOUT_URL,
    },
    annual: {
      price: "$249",
      period: "/mo",
      subtitle: "billed annually at $2,988",
      link: "https://buy.stripe.com/6oU4gzaHEf5005CbyU3oA0v",
      savings: "Save $600/yr",
    },
  };

  const verifiedPricing = {
    monthly: {
      price: "$499",
      period: "/mo",
      link: "https://buy.stripe.com/28E14ndTQ3mi3hO6eA3oA0x",
    },
    annual: {
      price: "$415",
      period: "/mo",
      subtitle: "billed annually at $4,979",
      link: "https://buy.stripe.com/28EdR90305uq05C0Ug3oA0w",
      savings: "Save $1,009/yr",
    },
  };

  const currentViewerPricing = isAnnual ? viewerPricing.annual : viewerPricing.monthly;
  const currentVerifiedPricing = isVerifiedAnnual ? verifiedPricing.annual : verifiedPricing.monthly;

  return (
    <div id="tiers-section" className="mt-10">
      <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-primary/5 via-yellow-500/10 to-primary/5 border-2 border-border">
        {/* Vendor Tiers Section */}
        <div className="text-center mb-8">
          <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
            Choose Your Access Level
          </h3>
          <p className="text-muted-foreground">
            Unlock {totalReviews}+ vendor reviews and {totalWarnings}+ warnings
          </p>
        </div>

        {/* Vendor Tiers - Stack on mobile, side by side on larger screens */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto mb-6">
          {/* Viewer Tier - For Vendors */}
          <div className="p-5 pt-8 rounded-xl bg-white border-2 border-border relative flex flex-col min-h-0">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-bold">
              READ ONLY
            </div>
                <div className="flex items-center gap-2 mb-1">
                  <Eye className="h-5 w-5 text-muted-foreground" />
                  <span className="font-bold text-foreground">Viewer</span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">View all vendor reviews & warnings</p>
                
                {/* Price + Toggle on same line */}
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div>
                    <span className="text-2xl font-bold text-foreground">{currentViewerPricing.price}</span>
                    <span className="text-sm text-muted-foreground">{currentViewerPricing.period}</span>
                    {isAnnual && (
                      <p className="text-xs text-green-600">{viewerPricing.annual.subtitle}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span 
                      onClick={() => setIsAnnual(false)}
                      className={cn("text-xs cursor-pointer", !isAnnual ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground")}
                    >
                      Monthly
                    </span>
                    <div 
                      onClick={() => setIsAnnual(!isAnnual)}
                      className={cn(
                        "relative w-9 h-5 rounded-full cursor-pointer transition-colors shrink-0",
                        isAnnual ? "bg-green-500" : "bg-muted-foreground/30"
                      )}
                    >
                      <div 
                        className={cn(
                          "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                          isAnnual ? "translate-x-[18px]" : "translate-x-0.5"
                        )}
                      />
                    </div>
                    <span 
                      onClick={() => setIsAnnual(true)}
                      className={cn("text-xs cursor-pointer", isAnnual ? "text-green-600 font-medium" : "text-muted-foreground hover:text-foreground")}
                    >
                      Annual
                    </span>
                  </div>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground mb-4 flex-1">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500 shrink-0" />
                    <span>See what dealers are saying</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500 shrink-0" />
                    <span>Search all reviews</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500 shrink-0" />
                    <span>Read-only access</span>
                  </li>
                </ul>
                <Button variant="outline" className="w-full font-bold mt-auto" asChild>
                  <a href={currentViewerPricing.link} target="_blank" rel="noopener noreferrer">
                    <Eye className="h-4 w-4 mr-2" />
                    Join as Viewer
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </a>
                </Button>
              </div>

          {/* Pro Tier */}
          <div className="p-5 pt-8 rounded-xl bg-white border-2 border-primary/30 relative flex flex-col">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-bold">
              MOST POPULAR
            </div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <span className="font-bold text-foreground">Pro</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Engage with dealer feedback</p>
                
                {/* Price + Toggle on same line */}
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div>
                    <span className="text-2xl font-bold text-foreground">{currentVerifiedPricing.price}</span>
                    <span className="text-sm text-muted-foreground">{currentVerifiedPricing.period}</span>
                    {isVerifiedAnnual && (
                      <p className="text-xs text-green-600">{verifiedPricing.annual.subtitle}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span 
                      onClick={() => setIsVerifiedAnnual(false)}
                      className={cn("text-xs cursor-pointer", !isVerifiedAnnual ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground")}
                    >
                      Monthly
                    </span>
                    <div 
                      onClick={() => setIsVerifiedAnnual(!isVerifiedAnnual)}
                      className={cn(
                        "relative w-9 h-5 rounded-full cursor-pointer transition-colors shrink-0",
                        isVerifiedAnnual ? "bg-green-500" : "bg-muted-foreground/30"
                      )}
                    >
                      <div 
                        className={cn(
                          "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                          isVerifiedAnnual ? "translate-x-[18px]" : "translate-x-0.5"
                        )}
                      />
                    </div>
                    <span 
                      onClick={() => setIsVerifiedAnnual(true)}
                      className={cn("text-xs cursor-pointer", isVerifiedAnnual ? "text-green-600 font-medium" : "text-muted-foreground hover:text-foreground")}
                    >
                      Annual
                    </span>
                  </div>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground mb-4 flex-1">
                  <li className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-primary shrink-0" />
                    <span><strong className="text-foreground">Website link</strong> on mentions</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary shrink-0" />
                    <span><strong className="text-foreground">Respond</strong> to reviews</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                    <span><strong className="text-foreground">Company profile</strong> page</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary shrink-0" />
                    <span><strong className="text-foreground">Monthly analytics</strong></span>
                  </li>
                </ul>
            <Button variant="yellow" className="w-full font-bold mt-auto" asChild>
              <a href={currentVerifiedPricing.link} target="_blank" rel="noopener noreferrer">
                <ShieldCheck className="h-4 w-4 mr-2" />
                Get Pro Access
                <ArrowRight className="h-4 w-4 ml-2" />
              </a>
            </Button>
          </div>
        </div>

        <p className="text-xs text-center text-muted-foreground mt-6">
          Already have an account?{" "}
          <button 
            onClick={onSignInClick}
            className="underline hover:text-foreground font-medium"
          >
            Sign in to unlock →
          </button>
        </p>
      </div>
    </div>
  );
};

export default VendorPricingTiers;