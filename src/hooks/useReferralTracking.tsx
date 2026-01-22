import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";

interface ReferralState {
  referralCode: string;
  referralCount: number;
  bonusEntries: number;
  isReferredVisitor: boolean;
}

const ENTRIES_PER_REFERRAL = 5;
const REFERRALS_NEEDED = 1; // 1 referral = 5 more entries

export const useReferralTracking = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, setState] = useState<ReferralState>({
    referralCode: "",
    referralCount: 0,
    bonusEntries: 0,
    isReferredVisitor: false,
  });

  useEffect(() => {
    // Get or generate referral code
    let code = localStorage.getItem("wins_referral_code");
    if (!code) {
      code = `CDG${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      localStorage.setItem("wins_referral_code", code);
    }

    // Get current referral count
    const countStr = localStorage.getItem("wins_referral_count");
    const count = countStr ? parseInt(countStr, 10) : 0;

    // Check if visitor came from a referral link
    const refParam = searchParams.get("ref");
    let isReferred = false;
    
    if (refParam && refParam !== code) {
      // This is a referred visitor - track it for the referrer
      const referredBy = localStorage.getItem("wins_referred_by");
      if (!referredBy) {
        // First time visit from this referral - mark it
        localStorage.setItem("wins_referred_by", refParam);
        isReferred = true;
        
        // Clean up URL (remove ref param)
        searchParams.delete("ref");
        setSearchParams(searchParams, { replace: true });
        
        // Increment referrer's count (simulated - in production use a backend)
        // For demo, we'll just track locally if someone comes from our own link
        // In production, you'd call an API to increment the referrer's count
      }
    }

    // Check if this user was someone else's referral
    const wasReferred = localStorage.getItem("wins_referred_by");

    setState({
      referralCode: code,
      referralCount: count,
      bonusEntries: Math.floor(count / REFERRALS_NEEDED) * ENTRIES_PER_REFERRAL,
      isReferredVisitor: isReferred || !!wasReferred,
    });
  }, [searchParams, setSearchParams]);

  // Function to simulate receiving a referral (for demo purposes)
  // In production, this would be handled by a backend
  const addReferral = () => {
    const newCount = state.referralCount + 1;
    localStorage.setItem("wins_referral_count", newCount.toString());
    
    const newBonusEntries = Math.floor(newCount / REFERRALS_NEEDED) * ENTRIES_PER_REFERRAL;
    
    setState(prev => ({
      ...prev,
      referralCount: newCount,
      bonusEntries: newBonusEntries,
    }));

    return newBonusEntries;
  };

  // Check and credit referral on incoming visit
  useEffect(() => {
    const refParam = searchParams.get("ref");
    const myCode = localStorage.getItem("wins_referral_code");
    const alreadyCredited = localStorage.getItem(`credited_ref_${refParam}`);
    
    if (refParam && refParam === myCode && !alreadyCredited) {
      // Someone visited with our referral link!
      // In production, you'd verify this server-side
      // For demo, we'll credit it locally
      const newCount = state.referralCount + 1;
      localStorage.setItem("wins_referral_count", newCount.toString());
      localStorage.setItem(`credited_ref_${refParam}`, "true");
      
      setState(prev => ({
        ...prev,
        referralCount: newCount,
        bonusEntries: Math.floor(newCount / REFERRALS_NEEDED) * ENTRIES_PER_REFERRAL,
      }));
    }
  }, []);

  return {
    ...state,
    addReferral,
    requiredReferrals: REFERRALS_NEEDED,
  };
};

export default useReferralTracking;
