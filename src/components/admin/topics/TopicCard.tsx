import { Check, X, Pin, Archive, Loader2, TrendingUp, MessageSquare, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Topic } from "@/types/admin";
import { SENTIMENT_COLORS } from "@/types/admin";

interface TopicCardProps {
  topic: Topic;
  onApprove?: () => void;
  onReject?: () => void;
  onTogglePin?: () => void;
  onToggleArchive?: () => void;
  onClick?: () => void;
  isUpdating?: boolean;
}

const TopicCard = ({
  topic,
  onApprove,
  onReject,
  onTogglePin,
  onToggleArchive,
  onClick,
  isUpdating,
}: TopicCardProps) => {
  const sentimentClass = topic.current_sentiment
    ? SENTIMENT_COLORS[topic.current_sentiment] || SENTIMENT_COLORS.unknown
    : SENTIMENT_COLORS.unknown;

  return (
    <div
      className="border border-zinc-800 rounded-xl p-4 space-y-2 bg-zinc-900/50 hover:bg-zinc-900/80 transition-colors cursor-pointer"
      onClick={onClick}
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-zinc-100 line-clamp-1">
              {topic.title}
            </h3>
            {topic.is_pinned && <Pin className="h-3 w-3 text-amber-500 flex-shrink-0" />}
          </div>
          {topic.theme && (
            <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{topic.theme}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {isUpdating ? (
            <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
          ) : (
            <>
              {onApprove && topic.status !== "active" && (
                <Button size="sm" variant="ghost" className="h-7 px-2 text-zinc-500 hover:text-green-400" onClick={onApprove}>
                  <Check className="h-3.5 w-3.5" />
                </Button>
              )}
              {onReject && topic.status !== "rejected" && (
                <Button size="sm" variant="ghost" className="h-7 px-2 text-zinc-500 hover:text-red-400" onClick={onReject}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
              {onTogglePin && (
                <Button
                  size="sm"
                  variant="ghost"
                  className={`h-7 px-2 ${topic.is_pinned ? "text-amber-500" : "text-zinc-500 hover:text-amber-400"}`}
                  onClick={onTogglePin}
                >
                  <Pin className="h-3.5 w-3.5" />
                </Button>
              )}
              {onToggleArchive && (
                <Button size="sm" variant="ghost" className="h-7 px-2 text-zinc-500 hover:text-zinc-300" onClick={onToggleArchive}>
                  <Archive className="h-3.5 w-3.5" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Badges + stats */}
      <div className="flex items-center gap-2 flex-wrap">
        {topic.current_sentiment && (
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${sentimentClass}`}>
            {topic.current_sentiment}
          </Badge>
        )}
        {topic.category && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-zinc-500 border-zinc-700">
            {topic.category}
          </Badge>
        )}
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-zinc-500 border-zinc-700">
          {topic.status}
        </Badge>
      </div>

      <div className="flex items-center gap-4 text-[10px] text-zinc-600">
        <span className="flex items-center gap-1">
          <TrendingUp className="h-3 w-3" />
          {topic.trending_score.toFixed(1)}
        </span>
        <span className="flex items-center gap-1">
          <MessageSquare className="h-3 w-3" />
          {topic.message_count}
        </span>
        <span className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          {topic.group_count} groups
        </span>
        {topic.last_message_at && (
          <span className="ml-auto">
            {new Date(topic.last_message_at).toLocaleDateString("en-GB")}
          </span>
        )}
      </div>
    </div>
  );
};

export default TopicCard;
