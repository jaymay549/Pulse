import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { vendorSupabase } from "@/integrations/supabase/vendorClient";
import type { Session, User } from "@supabase/supabase-js";

interface VendorAuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  session: Session | null;
  user: User | null;
  signOut: () => Promise<void>;
}

export function useVendorSupabaseAuth(): VendorAuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Initialize from persisted session in localStorage (vendor-auth key)
    vendorSupabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error("[VendorAuth] getSession error:", error);
      }
      setSession(data.session);
      setIsLoading(false);
    });

    // Subscribe to auth state changes (sign-in, sign-out, token refresh, expiry)
    const { data: { subscription } } = vendorSupabase.auth.onAuthStateChange(
      (event, currentSession) => {
        setSession(currentSession);

        // AUTH-08: Session expiry redirects to /vendor-login with re-auth prompt
        if (event === "SIGNED_OUT" && !currentSession) {
          navigate("/vendor-login?expired=true", { replace: true });
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  return {
    isLoading,
    isAuthenticated: !!session,
    session,
    user: session?.user ?? null,
    signOut: async () => {
      await vendorSupabase.auth.signOut();
    },
  };
}
