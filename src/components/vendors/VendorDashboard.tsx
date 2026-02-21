import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useClerkSupabase } from "@/hooks/useClerkSupabase";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { BarChart2, MessageSquare, TrendingUp } from "lucide-react";

interface VendorDashboardProps {
  vendorName: string;
}

// vendor_mentions columns: id (text), vendor_name, title, quote, type ("positive"|"warning"),
//   category, conversation_time, created_at
// vendor_responses columns: id (bigint), mention_id (text), org_id, responder_user_id,
//   response_text, status, created_at, updated_at
// INSERT policy: is_vendor_pro() AND org_id = get_clerk_org_id() — no vendor_name column

function VendorRespondTab({ vendorName }: { vendorName: string }) {
  const supabase = useClerkSupabase();
  const queryClient = useQueryClient();
  const [replies, setReplies] = useState<Record<string, string>>({});

  // Fetch the last 50 mentions for this vendor
  const { data: mentions = [] } = useQuery({
    queryKey: ["vendor-respond-mentions", vendorName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_mentions")
        .select("id, quote, type, created_at")
        .eq("vendor_name", vendorName)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch existing responses — keyed by mention_id, scoped to this org via RLS
  const { data: existingResponses = [] } = useQuery({
    queryKey: ["vendor-respond-responses", vendorName],
    queryFn: async () => {
      // Filter to mentions belonging to this vendor so we only get relevant responses.
      // The mention_id values are text IDs from vendor_mentions.
      const mentionIds = mentions.map((m: any) => m.id);
      if (mentionIds.length === 0) return [];
      const { data, error } = await supabase
        .from("vendor_responses")
        .select("mention_id, response_text, created_at")
        .in("mention_id", mentionIds);
      if (error) throw error;
      return data ?? [];
    },
    // Only run after mentions are loaded
    enabled: mentions.length > 0,
  });

  const respondedIds = new Set(existingResponses.map((r: any) => r.mention_id));

  const replyMutation = useMutation({
    mutationFn: async ({
      mentionId,
      responseText,
    }: {
      mentionId: string;
      responseText: string;
    }) => {
      const { error } = await supabase.from("vendor_responses").insert({
        mention_id: mentionId,
        response_text: responseText,
      } as never);
      if (error) throw error;
    },
    onSuccess: (_, { mentionId }) => {
      toast.success("Reply posted.");
      setReplies(prev => ({ ...prev, [mentionId]: "" }));
      queryClient.invalidateQueries({
        queryKey: ["vendor-respond-responses", vendorName],
      });
    },
    onError: (err: Error) => toast.error(`Failed to post reply: ${err.message}`),
  });

  if (mentions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No mentions yet for {vendorName}.
      </p>
    );
  }

  return (
    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
      {mentions.map((mention: any) => {
        const hasReply = respondedIds.has(mention.id);
        return (
          <div
            key={mention.id}
            className="border rounded-lg p-4 text-sm space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-foreground italic">"{mention.quote}"</p>
              <span
                className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                  mention.type === "positive"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {mention.type}
              </span>
            </div>
            {hasReply ? (
              <p className="text-xs text-muted-foreground">Already responded</p>
            ) : (
              <div className="flex gap-2">
                <textarea
                  className="flex-1 border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring bg-background"
                  rows={2}
                  placeholder="Write a response…"
                  value={replies[mention.id] ?? ""}
                  onChange={e =>
                    setReplies(prev => ({
                      ...prev,
                      [mention.id]: e.target.value,
                    }))
                  }
                />
                <button
                  className="shrink-0 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-md hover:opacity-90 disabled:opacity-50"
                  disabled={
                    !replies[mention.id]?.trim() ||
                    (replyMutation.isPending &&
                      replyMutation.variables?.mentionId === mention.id)
                  }
                  onClick={() =>
                    replyMutation.mutate({
                      mentionId: mention.id,
                      responseText: replies[mention.id].trim(),
                    })
                  }
                >
                  Post
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function VendorDashboard({ vendorName }: VendorDashboardProps) {
  return (
    <div className="mb-8 border rounded-xl bg-card p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-5">
        <Badge variant="secondary" className="text-xs">Vendor Dashboard</Badge>
        <span className="text-xs text-muted-foreground">Only visible to you</span>
      </div>
      <Tabs defaultValue="overview">
        <TabsList className="mb-5">
          <TabsTrigger value="overview" className="flex items-center gap-1.5 text-sm">
            <BarChart2 className="h-3.5 w-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="respond" className="flex items-center gap-1.5 text-sm">
            <MessageSquare className="h-3.5 w-3.5" />
            Respond
          </TabsTrigger>
          <TabsTrigger value="intel" className="flex items-center gap-1.5 text-sm">
            <TrendingUp className="h-3.5 w-3.5" />
            Market Intel
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <p className="text-sm text-muted-foreground">Overview loading…</p>
        </TabsContent>
        <TabsContent value="respond">
          <VendorRespondTab vendorName={vendorName} />
        </TabsContent>
        <TabsContent value="intel">
          <p className="text-sm text-muted-foreground">Intel loading…</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
