import { useEffect, useState } from "react";
import { useClerkAuth } from "./useClerkAuth";
import { useClerkSupabase } from "./useClerkSupabase";

export interface MemberProfile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsapp_number: string | null;
  dealership_name: string | null;
  role: string | null;
  role_band: string | null;
  oems: string[];
  rooftops: number | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  region: string | null;
  tier: string;
  cohort_id: string | null;
  status: string;
  biggest_focus: string | null;
  area_of_interest: string | null;
  annual_revenue: string | null;
  volunteer_group_leader: boolean;
}

export function useMemberProfile() {
  const { user, isAuthenticated } = useClerkAuth();
  const supabase = useClerkSupabase();
  const [member, setMember] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [linked, setLinked] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadOrLink() {
      setLoading(true);
      try {
        // Try to load member by clerk_user_id
        const { data } = await supabase
          .from("members" as never)
          .select("*")
          .eq("clerk_user_id", user!.id)
          .maybeSingle();

        if (cancelled) return;

        if (data) {
          setMember(data as unknown as MemberProfile);
          setLinked(true);
          return;
        }

        // Not linked yet — try to link by email
        if (user!.email) {
          const { data: memberId } = await supabase.rpc(
            "link_clerk_to_member" as never,
            {
              p_clerk_user_id: user!.id,
              p_email: user!.email,
            } as never
          );

          if (cancelled) return;

          if (memberId) {
            // Successfully linked — reload profile
            const { data: profile } = await supabase
              .from("members" as never)
              .select("*")
              .eq("clerk_user_id", user!.id)
              .maybeSingle();

            if (!cancelled && profile) {
              setMember(profile as unknown as MemberProfile);
              setLinked(true);
            }
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadOrLink();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.id, supabase]);

  return { member, loading, linked };
}
