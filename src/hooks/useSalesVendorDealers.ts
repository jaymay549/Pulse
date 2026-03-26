// src/hooks/useSalesVendorDealers.ts

import { useQuery } from "@tanstack/react-query";
import { useClerkSupabase } from "@/hooks/useClerkSupabase";
import type { VendorDealer } from "@/types/sales-targets";

export function useSalesVendorDealers(vendorName: string, enabled: boolean) {
  const supabase = useClerkSupabase();

  return useQuery({
    queryKey: ["sales-vendor-dealers", vendorName],
    queryFn: async (): Promise<VendorDealer[]> => {
      // 1. Confirmed users from tech stack
      const { data: techStackData } = await supabase
        .from("user_tech_stack" as never)
        .select("user_id, sentiment_score, switching_intent, status" as never)
        .ilike("vendor_name" as never, vendorName as never)
        .eq("is_current" as never, true as never);

      // 2. Community mentions with member attribution
      const { data: mentionData } = await supabase
        .from("vendor_mentions")
        .select("member_id, dimension, type, sentiment_score")
        .ilike("vendor_name", vendorName);

      // 3. Get unique member IDs from mentions
      const mentionMemberIds = [
        ...new Set(
          (mentionData || [])
            .filter((m: any) => m.member_id)
            .map((m: any) => m.member_id)
        ),
      ];

      // 4. Fetch member details
      const allMemberIds = [...mentionMemberIds];
      const { data: members } = allMemberIds.length > 0
        ? await supabase
            .from("members" as never)
            .select("id, clerk_user_id, name, dealership_name, rooftops, state, region" as never)
            .in("id" as never, allMemberIds as never)
        : { data: [] };

      // 5. Build confirmed user IDs set
      const confirmedUserIds = new Set(
        (techStackData || []).map((t: any) => t.user_id)
      );

      // 6. Map members to clerk_user_id for confirmed lookup
      const membersByClerkId = new Map<string, any>();
      const membersById = new Map<string, any>();
      for (const m of (members || []) as any[]) {
        if (m.clerk_user_id) membersByClerkId.set(m.clerk_user_id, m);
        membersById.set(m.id, m);
      }

      // 7. Build dealer list
      const dealers: VendorDealer[] = [];
      const seenMemberIds = new Set<string>();

      // Confirmed users (from tech stack)
      for (const ts of (techStackData || []) as any[]) {
        const member = membersByClerkId.get(ts.user_id);
        if (!member) continue;
        seenMemberIds.add(member.id);
        dealers.push({
          member_id: member.id,
          name: member.name || "Unknown",
          dealership_name: member.dealership_name,
          status: "Confirmed User",
          sentiment: ts.sentiment_score,
          rooftops: member.rooftops,
          region: member.state || member.region,
          switching: ts.switching_intent === true,
          mention_count: (mentionData || []).filter(
            (m: any) => m.member_id === member.id
          ).length,
        });
      }

      // Community members (not already confirmed)
      for (const memberId of mentionMemberIds) {
        if (seenMemberIds.has(memberId as string)) continue;
        const member = membersById.get(memberId as string);
        if (!member) continue;

        const memberMentions = (mentionData || []).filter(
          (m: any) => m.member_id === memberId
        );
        const hasUsageDimension = memberMentions.some((m: any) =>
          ["adopted", "support", "reliable", "integrates", "worth_it"].includes(
            m.dimension
          )
        );

        const avgSentiment =
          memberMentions.length > 0
            ? memberMentions.reduce(
                (sum: number, m: any) => sum + (m.sentiment_score || 0),
                0
              ) / memberMentions.length
            : null;

        dealers.push({
          member_id: member.id,
          name: member.name || "Unknown",
          dealership_name: member.dealership_name,
          status: hasUsageDimension ? "Likely User" : "Mentioned Only",
          sentiment: avgSentiment,
          rooftops: member.rooftops,
          region: member.state || member.region,
          switching: false,
          mention_count: memberMentions.length,
        });
      }

      // Sort: Confirmed > Likely > Mentioned Only
      const statusOrder = { "Confirmed User": 0, "Likely User": 1, "Mentioned Only": 2 };
      dealers.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

      return dealers;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}
