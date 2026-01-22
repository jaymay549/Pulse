import { useState, useEffect } from "react";
import { Gift, Users, Copy, Check, Twitter, Linkedin, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface ReferralUnlockProps {
  onUnlock: (additionalEntries: number) => void;
  currentReferrals: number;
  requiredReferrals: number;
}

const ReferralUnlock = ({ onUnlock, currentReferrals, requiredReferrals }: ReferralUnlockProps) => {
  const [copied, setCopied] = useState(false);
  const [referralCode, setReferralCode] = useState("");

  useEffect(() => {
    // Generate or retrieve referral code
    let code = localStorage.getItem("wins_referral_code");
    if (!code) {
      code = `CDG${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      localStorage.setItem("wins_referral_code", code);
    }
    setReferralCode(code);
  }, []);

  const referralUrl = `${window.location.origin}/wins-warnings?ref=${referralCode}`;
  const progress = Math.min((currentReferrals / requiredReferrals) * 100, 100);
  const entriesUnlocked = Math.floor(currentReferrals / requiredReferrals) * 5;

  const copyLink = async () => {
    await navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    toast({
      title: "Link copied!",
      description: "Share it with fellow dealers to unlock more insights",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const shareOnTwitter = () => {
    const text = encodeURIComponent("Check out these real vendor reviews from auto dealers. No BS, just honest feedback from the trenches 👇");
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(referralUrl)}`, '_blank');
  };

  const shareOnLinkedIn = () => {
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralUrl)}`, '_blank');
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Wins & Warnings - Real Dealer Vendor Reviews',
          text: 'Check out these honest vendor reviews from verified auto dealers',
          url: referralUrl,
        });
      } catch (err) {
        // User cancelled
      }
    } else {
      copyLink();
    }
  };

  return (
    <div className="col-span-full my-8">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-500/10 via-violet-500/10 to-purple-500/10 border-2 border-purple-500/30 p-8 sm:p-12">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-violet-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative max-w-xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/20 border border-purple-500/40 mb-6">
            <Gift className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-bold text-foreground">Referral Bonus</span>
          </div>
          
          <h3 className="text-2xl sm:text-3xl font-black text-foreground mb-3">
            Share & Unlock More Insights
          </h3>
          
          <p className="text-muted-foreground mb-6">
            For every friend who visits using your link, you'll unlock 5 more vendor reviews. No sign-up required!
          </p>
          
          {/* Progress */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2 text-sm">
              <span className="flex items-center gap-2 text-purple-600">
                <Users className="h-4 w-4" />
                {currentReferrals} of {requiredReferrals} referrals
              </span>
              {entriesUnlocked > 0 && (
                <span className="text-green-600 font-bold">
                  +{entriesUnlocked} unlocked!
                </span>
              )}
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-purple-500 to-violet-500 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          
          {/* Share buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-4">
            <Button
              onClick={copyLink}
              variant="outline"
              className="gap-2 border-purple-500/30 hover:bg-purple-500/10"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-green-500" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy Link
                </>
              )}
            </Button>
            
            <Button
              onClick={shareOnTwitter}
              variant="outline"
              className="gap-2 border-purple-500/30 hover:bg-purple-500/10"
            >
              <Twitter className="h-4 w-4" />
              Share on X
            </Button>
            
            <Button
              onClick={shareOnLinkedIn}
              variant="outline"
              className="gap-2 border-purple-500/30 hover:bg-purple-500/10"
            >
              <Linkedin className="h-4 w-4" />
              LinkedIn
            </Button>
            
            <Button
              onClick={nativeShare}
              variant="outline"
              className="gap-2 border-purple-500/30 hover:bg-purple-500/10 sm:hidden"
            >
              <Share2 className="h-4 w-4" />
              Share
            </Button>
          </div>
          
          {/* Referral URL display */}
          <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground break-all">
            {referralUrl}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReferralUnlock;
