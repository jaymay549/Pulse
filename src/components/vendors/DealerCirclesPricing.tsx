import React from "react";
import { Button } from "@/components/ui/button";
import { Check, Crown, ArrowRight, HelpCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface DealerCirclesPricingProps {
  totalReviews: number;
  totalWarnings: number;
  onSignInClick?: () => void;
}

export const DealerCirclesPricing: React.FC<DealerCirclesPricingProps> = ({
  totalReviews,
  totalWarnings,
  onSignInClick,
}) => (
  <div id="tiers-section" className="mt-10">
    <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-primary/5 via-yellow-500/10 to-primary/5 border-2 border-border">
      <div className="max-w-2xl mx-auto">
        <div className="p-5 rounded-xl bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-400/50 relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-yellow-500 text-yellow-950 text-xs font-bold">
            DEALERS ONLY
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Crown className="h-5 w-5 text-yellow-600" />
                <span className="font-bold text-foreground">
                  Circles Member
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                Private dealer peer groups + all vendor intel
              </p>
              <div className="flex items-center gap-1">
                <span className="text-xl font-bold text-foreground">$99</span>
                <span className="text-sm text-muted-foreground">/mo</span>
                <span className="text-xs text-muted-foreground ml-1">
                  (billed quarterly)
                </span>
                <Dialog>
                  <DialogTrigger asChild>
                    <button className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors">
                      <HelpCircle className="w-3.5 h-3.5" />
                    </button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Why quarterly billing?</DialogTitle>
                      <DialogDescription className="pt-4 text-base leading-relaxed">
                        Quarterly billing gives you time to experience the full
                        value of CDG Circles—building relationships with your
                        peer group and seeing real results. Three months is
                        enough to see ROI while keeping commitment manageable.
                      </DialogDescription>
                    </DialogHeader>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
            <div className="flex flex-col sm:items-end gap-2">
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Check className="h-3 w-3 text-green-500" />
                  {totalReviews}+ reviews
                </span>
                <span className="flex items-center gap-1">
                  <Check className="h-3 w-3 text-green-500" />
                  {totalWarnings}+ concerns
                </span>
                <span className="flex items-center gap-1">
                  <Check className="h-3 w-3 text-green-500" />
                  Peer discussions
                </span>
              </div>
              <Button variant="yellow" size="sm" className="font-bold" asChild>
                <a
                  href="https://cdgcircles.com/#pricing"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Crown className="h-4 w-4 mr-2" />
                  Join Circles Pro
                  <ArrowRight className="h-4 w-4 ml-2" />
                </a>
              </Button>
            </div>
          </div>
        </div>

        <p className="text-xs text-center text-muted-foreground mt-4">
          Already a Circles member?{" "}
          <button
            onClick={onSignInClick}
            className="underline hover:text-foreground font-medium"
          >
            Sign in to unlock →
          </button>
        </p>
      </div>
    </div>
  </div>
);

export default DealerCirclesPricing;
