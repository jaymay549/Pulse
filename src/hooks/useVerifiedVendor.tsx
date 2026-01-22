import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface VerifiedVendorProfile {
  id: string;
  vendor_name: string;
  is_approved: boolean;
  company_logo_url: string | null;
  company_website: string | null;
  contact_email: string | null;
}

interface UseVerifiedVendorResult {
  profile: VerifiedVendorProfile | null;
  isLoading: boolean;
  isVerified: boolean;
  canRespondTo: (vendorName: string) => boolean;
  refetch: () => Promise<void>;
}

export function useVerifiedVendor(): UseVerifiedVendorResult {
  const [profile, setProfile] = useState<VerifiedVendorProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setProfile(null);
        return;
      }

      const { data, error } = await supabase
        .from("vendor_profiles")
        .select("id, vendor_name, is_approved, company_logo_url, company_website, contact_email")
        .eq("user_id", user.id)
        .single();

      if (error) {
        if (error.code !== "PGRST116") {
          console.error("Failed to fetch vendor profile:", error);
        }
        setProfile(null);
        return;
      }

      setProfile(data);
    } catch (err) {
      console.error("Failed to fetch vendor profile:", err);
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchProfile();
    });

    return () => subscription.unsubscribe();
  }, []);

  const canRespondTo = (vendorName: string): boolean => {
    if (!profile || !profile.is_approved) return false;
    return profile.vendor_name.toLowerCase() === vendorName.toLowerCase();
  };

  return {
    profile,
    isLoading,
    isVerified: profile?.is_approved ?? false,
    canRespondTo,
    refetch: fetchProfile,
  };
}
