import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Flag, MessageSquare, Send, CheckCircle2, Clock, Filter, BarChart3, Info } from "lucide-react";
import {
  PieChart,
  Pie,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useClerkSupabase } from "@/hooks/useClerkSupabase";
import { useClerkAuth } from "@/hooks/useClerkAuth";
import { useFlagMention, useVendorFlags } from "@/hooks/useMentionFlags";
import { FlagMentionModal } from "./FlagMentionModal";
import { fetchVendorPulseFeed } from "@/hooks/useSupabaseVendorData";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface DashboardMentionsProps {
  vendorName: string;
  vendorProfileId?: string;
}

interface Mention {
  id: string;
  title: string | null;
  quote: string;
  type: string;
  conversationTime: string | null;
}

interface Response {
  mention_id: string;
  response_text: string;
  created_at: string;
}

type FilterType = "all" | "positive" | "negative" | "neutral" | "mixed";

function formatRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

const TYPE_CONFIG: Record<string, { bg: string; text: string; label: string; color: string }> = {
  positive: { bg: "bg-emerald-50", text: "text-emerald-700", label: "positive", color: "#10b981" },
  negative: { bg: "bg-red-50", text: "text-red-700", label: "concern", color: "#ef4444" },
  warning: { bg: "bg-red-50", text: "text-red-700", label: "concern", color: "#ef4444" },
  neutral: { bg: "bg-slate-50", text: "text-slate-600", label: "neutral", color: "#94a3b8" },
  mixed: { bg: "bg-amber-50", text: "text-amber-700", label: "mixed", color: "#f59e0b" },
};

function TypeBadge({ type }: { type: string }): JSX.Element {
  const config = TYPE_CONFIG[type] ?? TYPE_CONFIG.neutral;
  return (
    <Badge variant="secondary" className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border-none", config.bg, config.text)}>
      {config.label}
    </Badge>
  );
}

export function DashboardMentions({ vendorName, vendorProfileId }: DashboardMentionsProps): JSX.Element {
  const supabase = useClerkSupabase();
  const { user } = useClerkAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterType>("all");
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [flagModalOpen, setFlagModalOpen] = useState(false);
  const [selectedMention, setSelectedMention] = useState<Mention | null>(null);

  const { data: mentions = [] } = useQuery({
    queryKey: ["vendor-respond-mentions", vendorName],
    queryFn: async () => {
      const result = await fetchVendorPulseFeed({ vendorName, pageSize: 100 });
      return result.mentions.map((m) => ({
        id: String(m.id),
        title: m.title ?? null,
        quote: m.quote ?? "",
        type: m.type,
        conversationTime: m.conversationTime ?? null,
      })) as Mention[];
    },
  });

  const { data: existingResponses = [] } = useQuery({
    queryKey: ["vendor-respond-responses", vendorName],
    queryFn: async () => {
      const mentionIds = mentions.map((m) => m.id);
      if (mentionIds.length === 0) return [];
      const { data, error } = await supabase
        .from("vendor_responses")
        .select("mention_id, response_text, created_at")
        .in("mention_id", mentionIds);
      if (error) throw error;
      return (data ?? []) as Response[];
    },
    enabled: mentions.length > 0,
  });

  const { data: flags = [] } = useVendorFlags(vendorProfileId);
  const flaggedMentionIds = new Set(flags.map((f) => f.mention_id));

  const flagMutation = useFlagMention();

  const replyMutation = useMutation({
    mutationFn: async ({ mentionId, responseText }: { mentionId: string; responseText: string }) => {
      const { error } = await supabase.from("vendor_responses").insert({
        mention_id: mentionId,
        responder_user_id: user!.id,
        response_text: responseText,
      } as never);
      if (error) throw error;
    },
    onSuccess: (_, { mentionId }) => {
      toast.success("Reply posted.");
      setReplies((prev) => ({ ...prev, [mentionId]: "" }));
      queryClient.invalidateQueries({ queryKey: ["vendor-respond-responses", vendorName] });
    },
    onError: (err: Error) => toast.error(`Failed to post reply: ${err.message}`),
  });

  const respondedIds = new Set(existingResponses.map((r) => r.mention_id));

  const counts = {
    positive: mentions.filter((m) => m.type === "positive").length,
    negative: mentions.filter((m) => m.type === "negative" || m.type === "warning").length,
    neutral: mentions.filter((m) => m.type === "neutral").length,
    mixed: mentions.filter((m) => m.type === "mixed").length,
  };

  const filteredMentions = filter === "all"
    ? mentions
    : filter === "negative"
      ? mentions.filter((m) => m.type === "negative" || m.type === "warning")
      : mentions.filter((m) => m.type === filter);

  const handleFlag = (mention: Mention) => {
    setSelectedMention(mention);
    setFlagModalOpen(true);
  };

  const submitFlag = (reason: string, note: string) => {
    if (!vendorProfileId || !selectedMention) return;

    flagMutation.mutate(
      {
        mention_id: Number(selectedMention.id),
        vendor_profile_id: vendorProfileId,
        reason,
        note,
      },
      {
        onSuccess: () => {
          setFlagModalOpen(false);
          setSelectedMention(null);
        },
      }
    );
  };

  const chartData = [
    { name: "Positive", value: counts.positive, color: TYPE_CONFIG.positive.color },
    { name: "Mixed", value: counts.mixed, color: TYPE_CONFIG.mixed.color },
    { name: "Neutral", value: counts.neutral, color: TYPE_CONFIG.neutral.color },
    { name: "Concerns", value: counts.negative, color: TYPE_CONFIG.negative.color },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Discussions & Response</h1>
          <p className="text-slate-500 mt-1 font-medium">Engage with your community and monitor brand health</p>
        </div>
        <div className="flex items-center gap-2">
           <Badge className="bg-indigo-50 text-indigo-700 border-none font-bold px-3 py-1">
             {mentions.length} TOTAL DISCUSSIONS
           </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Sentiment Analysis Summary */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-slate-200 shadow-sm overflow-hidden sticky top-24">
            <CardHeader className="pb-2 bg-slate-50/50 border-b border-slate-100">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-indigo-500" />
                Community Sentiment
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center">
                <div style={{ width: '100%', height: 160 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={5}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12, boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="w-full space-y-3 mt-4">
                  {chartData.map((item) => (
                    <div key={item.name} className="flex items-center justify-between group">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-[13px] font-semibold text-slate-600 group-hover:text-slate-900 transition-colors">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-bold text-slate-900">{item.value}</span>
                        <span className="text-[11px] font-bold text-slate-400">({Math.round((item.value / mentions.length) * 100)}%)</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100 w-full">
                  <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100 flex gap-3">
                    <Info className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
                    <p className="text-[12px] leading-relaxed text-indigo-700 font-medium">
                      Responding to discussions improves your **Customer Experience** score by up to 15%.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Mentions List */}
        <div className="lg:col-span-2 space-y-6">
          {/* Filters Area */}
          <div className="bg-white border border-slate-200 p-2 rounded-2xl flex flex-wrap gap-1 shadow-sm">
            {[
              { id: "all", label: "All Feed", count: mentions.length },
              { id: "positive", label: "Positive", count: counts.positive },
              { id: "mixed", label: "Mixed", count: counts.mixed },
              { id: "neutral", label: "Neutral", count: counts.neutral },
              { id: "negative", label: "Concerns", count: counts.negative },
            ].filter(f => f.count > 0 || f.id === 'all').map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id as FilterType)}
                className={cn(
                  "px-4 py-2 rounded-xl text-[13px] font-bold transition-all duration-200 flex items-center gap-2",
                  filter === f.id 
                    ? "bg-slate-900 text-white shadow-md shadow-slate-200" 
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                {f.label}
                <Badge className={cn("px-1.5 h-4 text-[10px] min-w-[18px] justify-center border-none", filter === f.id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500")}>
                  {f.count}
                </Badge>
              </button>
            ))}
          </div>

          {/* Mentions Cards */}
          {mentions.length === 0 ? (
             <Card className="border-dashed border-2 bg-slate-50/50 py-20">
               <CardContent className="flex flex-col items-center justify-center text-center">
                 <div className="h-16 w-16 rounded-full bg-white shadow-sm flex items-center justify-center mb-4 text-slate-300">
                   <MessageSquare className="h-8 w-8" />
                 </div>
                 <h3 className="text-lg font-bold text-slate-900">No Discussions Found</h3>
                 <p className="text-slate-500 max-w-xs mx-auto mt-2">
                   We haven't detected any community discussions for **{vendorName}** yet.
                 </p>
               </CardContent>
             </Card>
          ) : (
            <div className="space-y-4">
              {filteredMentions.map((mention) => {
                const hasResponded = respondedIds.has(mention.id);
                const replyText = replies[mention.id] ?? "";
                const isFlagged = flaggedMentionIds.has(Number(mention.id));

                return (
                  <Card key={mention.id} className={cn(
                    "border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-all duration-200",
                    hasResponded && "border-emerald-100 bg-emerald-50/10"
                  )}>
                    <CardContent className="p-6">
                      <div className="flex flex-col gap-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <TypeBadge type={mention.type} />
                            <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                              <Clock className="h-3.5 w-3.5" />
                              {mention.conversationTime ? formatRelativeTime(mention.conversationTime) : "recent"}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {vendorProfileId && !isFlagged && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleFlag(mention)}
                                className="h-8 w-8 text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                                title="Flag for review"
                              >
                                <Flag className="h-4 w-4" />
                              </Button>
                            )}
                            {isFlagged && (
                              <Badge className="bg-amber-50 text-amber-700 border-amber-200 font-bold text-[10px]">FLAGGED FOR REVIEW</Badge>
                            )}
                          </div>
                        </div>

                        <div className="relative pl-4 border-l-2 border-slate-100">
                          {mention.title && (
                            <h4 className="text-sm font-bold text-slate-900 mb-1.5">{mention.title}</h4>
                          )}
                          <p className="text-[15px] leading-relaxed text-slate-700 italic font-medium">
                            "{mention.quote}"
                          </p>
                        </div>

                        <div className="mt-2 pt-4 border-t border-slate-100">
                          {hasResponded ? (
                            <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 w-fit px-3 py-1.5 rounded-lg border border-emerald-100">
                              <CheckCircle2 className="h-4 w-4" />
                              <span className="text-[13px] font-bold uppercase tracking-tight">Response Sent</span>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <div className="relative">
                                <Textarea
                                  className="w-full bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all min-h-[100px] text-[14px] leading-relaxed"
                                  placeholder="Type your official response here..."
                                  value={replyText}
                                  onChange={(e) => setReplies((prev) => ({ ...prev, [mention.id]: e.target.value }))}
                                />
                                <div className="absolute bottom-3 right-3 flex items-center gap-3">
                                   <span className={cn("text-[11px] font-bold", replyText.length > 500 ? "text-red-500" : "text-slate-400")}>
                                     {replyText.length} characters
                                   </span>
                                </div>
                              </div>
                              <div className="flex justify-end">
                                <Button
                                  size="sm"
                                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-2 px-6 shadow-md shadow-indigo-100"
                                  disabled={!replyText.trim() || replyMutation.isPending}
                                  onClick={() =>
                                    replyMutation.mutate({ mentionId: mention.id, responseText: replyText.trim() })
                                  }
                                >
                                  {replyMutation.isPending ? "Posting..." : "Post Official Response"}
                                  <Send className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Flag modal */}
      {selectedMention && (
        <FlagMentionModal
          open={flagModalOpen}
          onOpenChange={setFlagModalOpen}
          mentionQuote={selectedMention.quote}
          onSubmit={submitFlag}
          isPending={flagMutation.isPending}
        />
      )}
    </div>
  );
}
