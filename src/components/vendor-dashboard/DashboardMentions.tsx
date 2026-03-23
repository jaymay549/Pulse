import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Flag } from "lucide-react";
import {
  PieChart,
  Pie,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useClerkSupabase } from "@/hooks/useClerkSupabase";
import { useFlagMention, useVendorFlags } from "@/hooks/useMentionFlags";
import { FlagMentionModal } from "./FlagMentionModal";
import { fetchVendorPulseFeed } from "@/hooks/useSupabaseVendorData";

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

const TYPE_BADGE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  positive: { bg: "bg-emerald-100", text: "text-emerald-700", label: "positive" },
  negative: { bg: "bg-red-100", text: "text-red-700", label: "concern" },
  warning: { bg: "bg-red-100", text: "text-red-700", label: "concern" },
  neutral: { bg: "bg-slate-100", text: "text-slate-600", label: "neutral" },
  mixed: { bg: "bg-amber-100", text: "text-amber-700", label: "mixed" },
};

function TypeBadge({ type }: { type: string }): JSX.Element {
  const style = TYPE_BADGE_STYLES[type] ?? TYPE_BADGE_STYLES.neutral;
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}

function FilterButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      className={
        active
          ? "rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white"
          : "rounded-md border bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
      }
      onClick={onClick}
    >
      {label} ({count})
    </button>
  );
}

export function DashboardMentions({ vendorName, vendorProfileId }: DashboardMentionsProps): JSX.Element {
  const supabase = useClerkSupabase();
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

  const positiveCount = mentions.filter((m) => m.type === "positive").length;
  const negativeCount = mentions.filter((m) => m.type === "negative" || m.type === "warning").length;
  const neutralCount = mentions.filter((m) => m.type === "neutral").length;
  const mixedCount = mentions.filter((m) => m.type === "mixed").length;

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

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Mentions</h1>
      <p className="mt-1 text-sm text-slate-500">See what the community is saying and respond</p>

      {/* Sentiment breakdown donut */}
      {mentions.length > 0 && (
        <div className="mt-6 rounded-xl border bg-white p-5">
          <div className="flex items-center gap-6">
            <div style={{ width: 120, height: 120 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: "Positive", value: positiveCount, fill: "#10b981" },
                      { name: "Neutral", value: neutralCount, fill: "#94a3b8" },
                      { name: "Mixed", value: mixedCount, fill: "#f59e0b" },
                      { name: "Negative", value: negativeCount, fill: "#ef4444" },
                    ].filter((d) => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={52}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2">
              {[
                { label: "Positive", count: positiveCount, color: "bg-emerald-500" },
                { label: "Neutral", count: neutralCount, color: "bg-slate-400" },
                { label: "Mixed", count: mixedCount, color: "bg-amber-500" },
                { label: "Negative", count: negativeCount, color: "bg-red-500" },
              ].filter((r) => r.count > 0).map((r) => (
                <div key={r.label} className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sm text-slate-600">
                    <span className={`h-2.5 w-2.5 rounded-full ${r.color}`} /> {r.label}
                  </span>
                  <span className="text-sm font-semibold text-slate-900">{r.count} ({mentions.length > 0 ? Math.round((r.count / mentions.length) * 100) : 0}%)</span>
                </div>
              ))}
              <div className="border-t pt-2 mt-2">
                <span className="text-xs text-slate-400">Total: {mentions.length} mentions</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="mt-4 flex gap-2">
        <FilterButton label="All" count={mentions.length} active={filter === "all"} onClick={() => setFilter("all")} />
        <FilterButton label="Positive" count={positiveCount} active={filter === "positive"} onClick={() => setFilter("positive")} />
        {neutralCount > 0 && <FilterButton label="Neutral" count={neutralCount} active={filter === "neutral"} onClick={() => setFilter("neutral")} />}
        {mixedCount > 0 && <FilterButton label="Mixed" count={mixedCount} active={filter === "mixed"} onClick={() => setFilter("mixed")} />}
        <FilterButton label="Concerns" count={negativeCount} active={filter === "negative"} onClick={() => setFilter("negative")} />
      </div>

      {/* Mention cards */}
      {mentions.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">No mentions yet for {vendorName}.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {filteredMentions.map((mention) => {
            const hasResponded = respondedIds.has(mention.id);
            const replyText = replies[mention.id] ?? "";
            const isFlagged = flaggedMentionIds.has(Number(mention.id));

            return (
              <div key={mention.id} className="rounded-xl border bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {mention.title && (
                      <p className="text-sm font-medium text-slate-900 mb-1">{mention.title}</p>
                    )}
                    <p className="text-sm italic text-slate-700">{mention.quote}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <TypeBadge type={mention.type} />
                    {vendorProfileId && !isFlagged && (
                      <button
                        type="button"
                        onClick={() => handleFlag(mention)}
                        className="p-1.5 rounded-md hover:bg-slate-100 transition-colors"
                        title="Flag this mention"
                      >
                        <Flag className="h-4 w-4 text-slate-400 hover:text-amber-500" />
                      </button>
                    )}
                    {isFlagged && (
                      <span className="text-xs text-amber-600 font-medium">Flagged</span>
                    )}
                  </div>
                </div>
                <p className="mt-1 text-xs text-slate-400">{mention.conversationTime ? formatRelativeTime(mention.conversationTime) : ""}</p>

                <div className="mt-3">
                  {hasResponded ? (
                    <p className="text-xs font-medium text-emerald-600">Responded</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <textarea
                        className="w-full rounded-md border px-3 py-2 text-sm"
                        rows={2}
                        placeholder="Write a response..."
                        value={replyText}
                        onChange={(e) => setReplies((prev) => ({ ...prev, [mention.id]: e.target.value }))}
                      />
                      <div>
                        <button
                          type="button"
                          className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                          disabled={!replyText.trim() || replyMutation.isPending}
                          onClick={() =>
                            replyMutation.mutate({ mentionId: mention.id, responseText: replyText.trim() })
                          }
                        >
                          Post
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

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
