import { useState } from "react";
import { Check, Star, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface GainAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GainAccessModal = ({ isOpen, onClose }: GainAccessModalProps) => {
  const [billingPeriod, setBillingPeriod] = useState<'quarterly' | 'annual'>('quarterly');
  const [execBillingPeriod, setExecBillingPeriod] = useState<'quarterly' | 'annual'>('quarterly');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="text-center mb-4">
          <div className="flex items-center justify-center gap-3">
            <DialogTitle className="text-2xl sm:text-4xl font-bold text-foreground">
              Choose Your Membership
            </DialogTitle>
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className="inline-flex items-center align-middle mt-1">
                  <Info className="h-5 w-5 text-foreground/50 cursor-pointer hover:text-foreground/70 transition-colors" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="max-w-xs">
                <p className="text-sm">Open to all dealership leaders: Dealer Principals, GMs, Directors (Used Car, Marketing, Service), CFOs, CTOs, and other C-suite executives and managers</p>
              </PopoverContent>
            </Popover>
          </div>
          <p className="text-sm sm:text-base text-foreground/70 max-w-2xl mx-auto mt-2">
            Select the package that fits your growth goals.
          </p>
        </DialogHeader>

        {/* Two-column grid: Pro + Executive */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Pro Tier */}
          <Card className="p-6 border-2 border-primary relative bg-primary/5 flex flex-col">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-secondary text-white px-4 py-1 rounded-full text-sm font-bold uppercase tracking-wide shadow-lg">
              Best Deal
            </div>
            <div className="mb-4 mt-2">
              <div className="flex items-center gap-2 mb-2">
                <Star className="h-5 w-5 text-secondary fill-secondary" />
                <h3 className="text-lg font-semibold text-foreground">Pro</h3>
              </div>

              <div className="flex items-baseline gap-2 mb-1">
                <div className="text-4xl font-extrabold text-foreground tracking-tight">
                  ${billingPeriod === 'quarterly' ? '99' : '82'}
                </div>
                <div className="text-foreground/70 text-sm">/month</div>
              </div>
              <div className="text-xs text-foreground/70 mb-2">
                {billingPeriod === 'quarterly' ? 'billed quarterly ($297)' : 'billed annually ($984)'}
              </div>

              <div className="flex gap-2 mb-2 p-1 bg-white/50 rounded-lg">
                <button
                  onClick={() => setBillingPeriod('quarterly')}
                  className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-all ${
                    billingPeriod === 'quarterly'
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-foreground/70 hover:text-foreground'
                  }`}
                >
                  Quarterly
                </button>
                <button
                  onClick={() => setBillingPeriod('annual')}
                  className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-all flex flex-col items-center ${
                    billingPeriod === 'annual'
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-foreground/70 hover:text-foreground'
                  }`}
                >
                  <span>Annual</span>
                  <span className="text-[10px]">(Save 17%)</span>
                </button>
              </div>

              <Dialog>
                <DialogTrigger asChild>
                  <button className="text-xs text-primary hover:underline cursor-pointer mb-1">
                    Why billed quarterly?
                  </button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Why quarterly billing?</DialogTitle>
                    <DialogDescription className="pt-4 text-base leading-relaxed">
                      Quarterly billing gives you time to experience the full value of CDG Circles—building relationships with your peer group and seeing real results. Three months is enough to see ROI while keeping commitment manageable.
                    </DialogDescription>
                  </DialogHeader>
                </DialogContent>
              </Dialog>

              <p className="text-xs text-foreground/70 italic">For performance-driven operators</p>
            </div>

            <ul className="space-y-2 mb-4 flex-grow text-sm">
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-foreground/80"><strong>Focused chats:</strong> Topic-based groups (Fixed Ops, AI, Rural, Urban, and more)</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-foreground/80"><strong>OEM dealer chats:</strong> Brand-specific discussions with dealers who share your franchise</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-foreground/80"><strong>Live benchmarking:</strong> Compare your store's numbers and processes against other operators in real time</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-foreground/80"><strong>Raw vendor intel:</strong> Access 2,300+ real dealer reviews and warnings on the tools you're evaluating</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-foreground/80"><strong>Monthly roundtables:</strong> Optional live sessions to share wins, challenges, and strategies</span>
              </li>
            </ul>

            {/* Testimonial */}
            <div className="p-3 bg-white/50 rounded-lg border border-primary/20 mt-auto mb-4">
              <p className="text-xs text-foreground/80 italic mb-2">
                "Being able to open my phone, fire off a question, and immediately get thoughtful responses—that's the power of the room."
              </p>
              <p className="text-[10px] text-foreground/60 font-medium">
                - Kate Downing, COO, Williams Auto Group
              </p>
            </div>

            <div>
              <Button
                variant="yellow"
                size="lg"
                className="w-full"
                asChild
              >
                <a
                  href={billingPeriod === 'quarterly'
                    ? "https://buy.stripe.com/fZu28raHEe0W6u07iE3oA0h"
                    : "https://buy.stripe.com/4gMbJ1eXUe0WcSofPa3oA0k"
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  data-rewardful
                >
                  Join Pro
                </a>
              </Button>
              <p className="text-center text-xs text-foreground/60 mt-2 flex items-center justify-center gap-3">
                <span>Strict confidentiality</span>
                <span>1,000+ dealers</span>
              </p>
            </div>
          </Card>

          {/* Executive Tier */}
          <Card className="p-6 border-2 border-secondary bg-foreground text-white relative overflow-hidden flex flex-col">
            <div className="absolute top-0 right-0 w-48 h-48 bg-secondary/20 rounded-full blur-3xl"></div>

            <div className="mb-4 relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <Star className="h-5 w-5 text-secondary fill-secondary" />
                <h3 className="text-lg font-semibold text-white">Executive</h3>
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <div className="text-4xl font-extrabold text-white tracking-tight">
                  ${execBillingPeriod === 'quarterly' ? '299' : '249'}
                </div>
                <div className="text-white/70 text-sm">/month</div>
              </div>
              <div className="text-xs text-white/70 mb-2">
                {execBillingPeriod === 'quarterly' ? 'billed quarterly ($897)' : 'billed annually ($2,978)'}
              </div>

              <div className="flex gap-2 mb-2 p-1 bg-white/10 rounded-lg">
                <button
                  onClick={() => setExecBillingPeriod('quarterly')}
                  className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-all ${
                    execBillingPeriod === 'quarterly'
                      ? 'bg-secondary text-foreground shadow-sm'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  Quarterly
                </button>
                <button
                  onClick={() => setExecBillingPeriod('annual')}
                  className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-all flex flex-col items-center ${
                    execBillingPeriod === 'annual'
                      ? 'bg-secondary text-foreground shadow-sm'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  <span>Annual</span>
                  <span className="text-[10px]">(Save 17%)</span>
                </button>
              </div>

              <Dialog>
                <DialogTrigger asChild>
                  <button className="text-xs text-secondary hover:underline cursor-pointer mb-1">
                    Why billed quarterly?
                  </button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Why quarterly billing?</DialogTitle>
                    <DialogDescription className="pt-4 text-base leading-relaxed">
                      Quarterly billing gives you time to experience the full value of Executive—building relationships, accessing exclusive intel, and leveraging the network. Three months is enough to see real ROI while keeping commitment manageable.
                    </DialogDescription>
                  </DialogHeader>
                </DialogContent>
              </Dialog>
              <p className="text-xs text-white/70 italic">Best for high-growth dealership executives</p>
            </div>

            <ul className="space-y-2 mb-4 relative z-10 flex-grow text-sm">
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-secondary mt-0.5 flex-shrink-0" />
                <span className="text-white/90 font-medium">Everything in Pro, plus:</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-secondary mt-0.5 flex-shrink-0" />
                <span className="text-white/90"><strong>Private dealer circles:</strong> Your own curated circle matched by performance, role, and goals</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-secondary mt-0.5 flex-shrink-0" />
                <span className="text-white/90"><strong>Elite network:</strong> Carefully curated community with our top dealers where partnerships and deals happen regularly</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-secondary mt-0.5 flex-shrink-0" />
                <span className="text-white/90"><strong>Personal concierge:</strong> A dedicated point of contact for white-glove onboarding, introductions, and ongoing support</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-secondary mt-0.5 flex-shrink-0" />
                <span className="text-white/90"><strong><a href="https://cdgexperiences.com/boulder-retreat-2026" target="_blank" rel="noopener noreferrer" className="underline hover:text-secondary transition-colors font-bold">Executive Retreat 2026:</a></strong> Priority consideration for our 3-day immersion in Boulder, CO <span className="text-white/50 text-xs">(apply separately)</span></span>
              </li>
            </ul>

            {/* Testimonial */}
            <div className="p-3 bg-white/10 rounded-lg border border-secondary/20 relative z-10 mt-auto mb-4">
              <p className="text-xs text-white/90 italic mb-2">
                "Joining Circles was the single best decision I made this year. It's like having a private board of top dealers who actually share what works."
              </p>
              <p className="text-[10px] text-white/70 font-medium">
                - Andy Wright, Dealer Principal, Vinart Auto Group
              </p>
            </div>

            <div className="relative z-10">
              <Button
                variant="secondary"
                size="lg"
                className="w-full"
                asChild
              >
                <a
                  href={execBillingPeriod === 'quarterly'
                    ? "https://buy.stripe.com/fZuaEXbLI9KG9GcbyU3oA0p"
                    : "https://buy.stripe.com/6oUfZh4jgcWSbOk0Ug3oA0o"
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  data-rewardful
                >
                  Join Executive
                </a>
              </Button>
              <p className="text-center text-xs text-white/60 mt-2">
                Satisfaction guaranteed
              </p>
            </div>
          </Card>
        </div>

        {/* Community Tier — compact row at bottom */}
        <div className="mt-6 rounded-xl border border-border bg-slate-50/50 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground mb-1">Just want to chat?</h3>
            <p className="text-xs text-foreground/60">
              Join our <strong>Community</strong> tier for <strong>$1/month</strong> and get access to the general Circles dealer chat. No vendor intel — just peer conversations with other operators.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 sm:ml-4"
            asChild
          >
            <a
              href="https://buy.stripe.com/28EfZhcPMg949GcauQ3oA0D"
              target="_blank"
              rel="noopener noreferrer"
            >
              Join Community — $1/mo
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GainAccessModal;
