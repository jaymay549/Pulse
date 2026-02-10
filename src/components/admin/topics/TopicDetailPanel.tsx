import { X, TrendingUp, MessageSquare, Users, ThumbsUp, ThumbsDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useTopicDetail, useTopicSentimentHistory, useTopicVotes } from "@/hooks/useTopics";
import { SENTIMENT_COLORS } from "@/types/admin";

interface TopicDetailPanelProps {
  topicId: string | null;
  onClose: () => void;
}

const TopicDetailPanel = ({ topicId, onClose }: TopicDetailPanelProps) => {
  const { data: topic } = useTopicDetail(topicId);
  const { data: sentimentHistory } = useTopicSentimentHistory(topicId);
  const { data: votes } = useTopicVotes(topicId);

  if (!topic) return null;

  const upvotes = votes?.filter((v) => v.vote_type === "upvote").length || 0;
  const downvotes = votes?.filter((v) => v.vote_type === "downvote").length || 0;

  const sentimentClass = topic.current_sentiment
    ? SENTIMENT_COLORS[topic.current_sentiment] || SENTIMENT_COLORS.unknown
    : SENTIMENT_COLORS.unknown;

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-zinc-950 border-l border-zinc-800 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-100 truncate">{topic.title}</h2>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-zinc-500" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          {/* Status badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${sentimentClass}`}>
              {topic.current_sentiment || "unknown"}
            </Badge>
            {topic.category && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-zinc-500 border-zinc-700">
                {topic.category}
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-zinc-500 border-zinc-700">
              {topic.status}
            </Badge>
          </div>

          {/* Theme */}
          {topic.theme && (
            <div>
              <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Theme</span>
              <p className="text-xs text-zinc-300 mt-1">{topic.theme}</p>
            </div>
          )}

          {/* Insight */}
          {topic.insight && (
            <div>
              <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Insight</span>
              <p className="text-xs text-zinc-300 mt-1">{topic.insight}</p>
            </div>
          )}

          {/* Actionable insight */}
          {topic.actionable_insight && (
            <div>
              <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Actionable Insight</span>
              <p className="text-xs text-zinc-300 mt-1">{topic.actionable_insight}</p>
            </div>
          )}

          <Separator className="bg-zinc-800" />

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3">
            <StatBox icon={<TrendingUp className="h-3.5 w-3.5" />} label="Trending" value={topic.trending_score.toFixed(1)} />
            <StatBox icon={<MessageSquare className="h-3.5 w-3.5" />} label="Messages" value={topic.message_count.toString()} />
            <StatBox icon={<Users className="h-3.5 w-3.5" />} label="Groups" value={topic.group_count.toString()} />
          </div>

          {/* Votes */}
          {votes && votes.length > 0 && (
            <div>
              <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Votes</span>
              <div className="flex items-center gap-4 mt-1">
                <span className="flex items-center gap-1 text-xs text-green-400">
                  <ThumbsUp className="h-3 w-3" /> {upvotes}
                </span>
                <span className="flex items-center gap-1 text-xs text-red-400">
                  <ThumbsDown className="h-3 w-3" /> {downvotes}
                </span>
              </div>
            </div>
          )}

          {/* Score breakdown */}
          {topic.score_breakdown && Object.keys(topic.score_breakdown).length > 0 && (
            <div>
              <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Score Breakdown</span>
              <div className="mt-1 space-y-1">
                {Object.entries(topic.score_breakdown).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400 capitalize">{key.replace(/_/g, " ")}</span>
                    <span className="text-zinc-300 font-medium">{typeof value === "number" ? value.toFixed(2) : value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator className="bg-zinc-800" />

          {/* Sentiment history */}
          {sentimentHistory && sentimentHistory.length > 0 && (
            <div>
              <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Sentiment History</span>
              <div className="mt-1 space-y-1">
                {sentimentHistory.map((h) => {
                  const hClass = SENTIMENT_COLORS[h.sentiment] || SENTIMENT_COLORS.unknown;
                  return (
                    <div key={h.id} className="flex items-center justify-between text-xs">
                      <span className={hClass}>{h.sentiment}</span>
                      <span className="text-zinc-500">
                        {new Date(h.recorded_at).toLocaleDateString("en-GB")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Voter list */}
          {votes && votes.length > 0 && (
            <div>
              <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Voters</span>
              <div className="mt-1 space-y-1">
                {votes.map((v) => (
                  <div key={v.id} className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400">{v.user_name || v.phone_number}</span>
                    <span className={v.vote_type === "upvote" ? "text-green-400" : "text-red-400"}>
                      {v.vote_type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

function StatBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="border border-zinc-800 rounded-lg p-2.5 text-center">
      <div className="flex items-center justify-center text-zinc-500 mb-1">{icon}</div>
      <div className="text-sm font-semibold text-zinc-200">{value}</div>
      <div className="text-[10px] text-zinc-600">{label}</div>
    </div>
  );
}

export default TopicDetailPanel;
