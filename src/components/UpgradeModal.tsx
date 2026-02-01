import { useState } from "react";
import { Crown, Star, Users, Check, ArrowRight, MessageCircle, Search, Zap, Calendar } from "lucide-react";
import { useClerkAuth } from "@/hooks/useClerkAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetTier?: 'pro' | 'executive';
}

const tierConfig = {
  free: {
    name: 'Community',
    icon: Users,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    borderColor: 'border-muted',
  },
  community: {
    name: 'Community',
    icon: Users,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    borderColor: 'border-muted',
  },
  pro: {
    name: 'Pro',
    icon: Star,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    borderColor: 'border-primary/30',
    price: '$99/mo',
    annualPrice: '$82/mo',
  },
  executive: {
    name: 'Executive',
    icon: Crown,
    color: 'text-secondary',
    bgColor: 'bg-secondary/10',
    borderColor: 'border-secondary/30',
    price: '$299/mo',
    annualPrice: '$249/mo',
  },
};

const upgradeFeatures = {
  'free-to-pro': [
    { icon: MessageCircle, text: 'Focused chats by topic (Rural, Urban, AI, Fixed Ops)', highlight: true },
    { icon: Star, text: 'OEM dealer chats by franchise', highlight: true },
    { icon: Search, text: 'Raw vendor intel (100+ reviews)', highlight: true },
    { icon: Calendar, text: 'Monthly roundtables with your cohort', highlight: false },
  ],
  'free-to-executive': [
    { icon: Crown, text: 'Private dealer circles (curated matching)', highlight: true },
    { icon: Users, text: 'Elite dealer network access', highlight: true },
    { icon: Calendar, text: 'Executive Retreat 2026 access', highlight: true },
    { icon: Search, text: 'Full vendor intel access (100+ reviews)', highlight: false },
    { icon: Zap, text: 'Priority support & early access', highlight: false },
  ],
  'pro-to-executive': [
    { icon: Crown, text: 'Private dealer circles (curated matching)', highlight: true },
    { icon: Users, text: 'Elite dealer network access', highlight: true },
    { icon: Calendar, text: 'Executive Retreat 2026 access', highlight: true },
    { icon: Zap, text: 'Priority support & early feature access', highlight: false },
  ],
};

const UpgradeModal = ({ isOpen, onClose, targetTier }: UpgradeModalProps) => {
  const { tier, isLoading } = useClerkAuth();
  
  // Map Clerk tier to local tier format
  const userTier = tier === 'community' ? 'free' : tier;

  // Determine target tier based on current tier if not specified
  const effectiveTargetTier = targetTier || (userTier === 'free' ? 'pro' : 'executive');
  
  // Get the appropriate features list
  const getFeatureKey = (): keyof typeof upgradeFeatures => {
    if (userTier === 'free' && effectiveTargetTier === 'pro') return 'free-to-pro';
    if (userTier === 'free' && effectiveTargetTier === 'executive') return 'free-to-executive';
    return 'pro-to-executive';
  };

  const features = upgradeFeatures[getFeatureKey()];
  const currentTierConfig = tierConfig[userTier] || tierConfig.free;
  const targetTierConfig = tierConfig[effectiveTargetTier];
  const TargetIcon = targetTierConfig.icon;

  // If user is already at the target tier or higher, don't show upgrade
  const canUpgrade = 
    (userTier === 'free' && (effectiveTargetTier === 'pro' || effectiveTargetTier === 'executive')) ||
    (userTier === 'pro' && effectiveTargetTier === 'executive');

  if (!canUpgrade && !isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-secondary" />
              You're Already There!
            </DialogTitle>
          </DialogHeader>
          <div className="text-center py-6">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${targetTierConfig.bgColor} ${targetTierConfig.borderColor} border mb-4`}>
              <TargetIcon className={`h-5 w-5 ${targetTierConfig.color}`} />
              <span className={`font-semibold ${targetTierConfig.color}`}>{targetTierConfig.name} Member</span>
            </div>
            <p className="text-muted-foreground">
              You already have access to all {targetTierConfig.name} features.
            </p>
          </div>
          <Button variant="outline" onClick={onClose} className="w-full">
            Close
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        {/* Header with gradient */}
        <div className={`p-6 pb-4 bg-gradient-to-br ${effectiveTargetTier === 'executive' ? 'from-yellow-500/20 to-yellow-600/10' : 'from-primary/10 to-primary/5'}`}>
          <DialogHeader className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-2 rounded-full ${targetTierConfig.bgColor}`}>
                <TargetIcon className={`h-5 w-5 ${targetTierConfig.color}`} />
              </div>
              <DialogTitle className="text-xl font-bold">
                Unlock {targetTierConfig.name} Access
              </DialogTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              Get full access to vendor intel and dealer insights
            </p>
          </DialogHeader>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Loading...</div>
        ) : (
          <div className="p-6 pt-4 space-y-5">
            {/* What you'll get - Compact list */}
            <div>
              <h3 className="font-semibold text-foreground mb-3 text-sm uppercase tracking-wide">What you'll unlock</h3>
              <ul className="space-y-2.5">
                {features.slice(0, 4).map((feature, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <div className={`p-1 rounded-full ${feature.highlight ? targetTierConfig.bgColor : 'bg-muted'}`}>
                      <Check className={`h-3.5 w-3.5 ${feature.highlight ? targetTierConfig.color : 'text-muted-foreground'}`} />
                    </div>
                    <span className="text-sm text-foreground">
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Pricing - Cleaner */}
            <div className={`p-4 rounded-xl ${targetTierConfig.bgColor} border ${targetTierConfig.borderColor}`}>
              <div className="flex items-baseline justify-between">
                <div>
                  <span className={`text-2xl font-bold ${targetTierConfig.color}`}>
                    {targetTierConfig.price}
                  </span>
                  <span className="text-sm text-muted-foreground ml-1">/ month</span>
                </div>
                <span className="text-xs text-muted-foreground">billed quarterly</span>
              </div>
            </div>

            {/* CTAs - Clean stack */}
            <div className="flex flex-col gap-2">
              <Button 
                variant={effectiveTargetTier === 'executive' ? 'yellow' : 'default'}
                size="lg"
                className="w-full font-bold"
                asChild
              >
                <a 
                  href="/#pricing" 
                  onClick={onClose}
                >
                  <TargetIcon className="h-4 w-4 mr-2" />
                  View Plans
                  <ArrowRight className="h-4 w-4 ml-2" />
                </a>
              </Button>
              <Button variant="ghost" onClick={onClose} className="text-muted-foreground text-sm">
                Maybe later
              </Button>
            </div>

            {/* Trust signals - Single line */}
            <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground pt-3 border-t">
              <span>✓ Cancel anytime</span>
              <span>•</span>
              <span>✓ 1,000+ dealers</span>
              <span>•</span>
              <span>✓ Secure</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default UpgradeModal;
