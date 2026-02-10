import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, MessageSquare, Clock, Loader2, Trash2, Brain } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import MentionRow from "./MentionRow";
import type { VendorQueueItem, QueueItemMention } from "@/types/admin";
import { parseAIResponse, parseConversationChunk } from "@/hooks/useVendorQueue";

interface QueueItemCardProps {
  item: VendorQueueItem;
  onApproveMention: (mention: QueueItemMention) => Promise<void>;
  onRejectMention: (mention: QueueItemMention, addToIgnore: boolean) => void;
  onUndoMention?: (mention: QueueItemMention) => Promise<void>;
  onShowThinking?: (thinking: string, vendorName: string) => void;
  onProcessItem?: (id: number) => Promise<void>;
  onDeleteItem?: (id: number) => Promise<void>;
  onShowItemThinking?: (id: number) => void;
  approvedMentionIds?: Set<string>;
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-900/30 text-amber-400 border-amber-800" },
  processing: { label: "Processing", className: "bg-blue-900/30 text-blue-400 border-blue-800" },
  processed: { label: "Processed", className: "bg-green-900/30 text-green-400 border-green-800" },
  failed: { label: "Failed", className: "bg-red-900/30 text-red-400 border-red-800" },
};

const QueueItemCard = ({
  item,
  onApproveMention,
  onRejectMention,
  onUndoMention,
  onShowThinking,
  onProcessItem,
  onDeleteItem,
  onShowItemThinking,
  approvedMentionIds,
}: QueueItemCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!onDeleteItem || !confirm("Delete this queue item?")) return;
    setDeleting(true);
    try {
      await onDeleteItem(item.id);
    } finally {
      setDeleting(false);
    }
  };

  const aiResponse = useMemo(() => parseAIResponse(item.ai_response), [item.ai_response]);
  const messages = useMemo(() => parseConversationChunk(item.conversation_chunk), [item.conversation_chunk]);
  const mentions = aiResponse?.mentions || [];

  const statusBadge = STATUS_BADGES[item.status] || STATUS_BADGES.pending;

  const timeRange = useMemo(() => {
    if (!item.conversation_start_time || !item.conversation_end_time) return null;
    const fmt = (d: string) => new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    return `${fmt(item.conversation_start_time)} – ${fmt(item.conversation_end_time)}`;
  }, [item.conversation_start_time, item.conversation_end_time]);

  const handleProcess = async () => {
    if (!onProcessItem) return;
    setProcessing(true);
    try {
      await onProcessItem(item.id);
    } finally {
      setProcessing(false);
    }
  };

  const mentionKey = (m: QueueItemMention) =>
    `${m.vendor_name}::${m.dimension}::${m.sentiment}::${m.snippet_anon?.slice(0, 40)}`;

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Clickable header */}
      <button
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-zinc-800/40 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-zinc-500 flex-shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-zinc-500 flex-shrink-0" />
          )}
          <span className="font-medium text-zinc-100 text-sm truncate">
            {item.group_name || `Group #${item.group_id}`}
          </span>
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusBadge.className}`}>
            {statusBadge.label}
          </Badge>
          {mentions.length > 0 && (
            <span className="text-[10px] text-zinc-500">
              {mentions.length} mention{mentions.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-zinc-500 flex-shrink-0">
          {item.message_count && (
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {item.message_count}
            </span>
          )}
          {timeRange && (
            <span className="flex items-center gap-1 hidden sm:flex">
              <Clock className="h-3 w-3" />
              {timeRange}
            </span>
          )}
        </div>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-zinc-800 px-4 py-3 space-y-3">
          {/* Actions bar */}
          <div className="flex items-center gap-2 flex-wrap">
            {item.status === "pending" && onProcessItem && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-zinc-700 text-zinc-300"
                onClick={handleProcess}
                disabled={processing}
              >
                {processing ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : null}
                Process with AI
              </Button>
            )}
            {messages.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-zinc-400"
                onClick={() => setShowMessages((v) => !v)}
              >
                {showMessages ? "Hide" : "Show"} Messages ({messages.length})
              </Button>
            )}
            {item.status === "processed" && onShowItemThinking && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-zinc-400"
                onClick={() => onShowItemThinking(item.id)}
              >
                <Brain className="h-3 w-3 mr-1" />
                AI Thinking
              </Button>
            )}
            {onDeleteItem && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-zinc-500 hover:text-red-400"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              </Button>
            )}
            {item.processor_version && (
              <span className="text-[10px] text-zinc-600 ml-auto">
                v{item.processor_version}
              </span>
            )}
          </div>

          {/* Conversation messages */}
          {showMessages && messages.length > 0 && (
            <ScrollArea className="max-h-60 border border-zinc-800 rounded-lg">
              <div className="p-3 space-y-2">
                {messages.map((msg, i) => (
                  <div key={msg.id || i} className="text-xs">
                    <span className="font-medium text-zinc-300">{msg.sender}:</span>{" "}
                    <span className="text-zinc-500">{msg.content}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* AI Mentions */}
          {mentions.length > 0 ? (
            <div className="space-y-2">
              <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                AI-Extracted Mentions
              </span>
              {mentions.map((mention, i) => {
                const key = mentionKey(mention);
                const isApproved = mention.approved_mention_id != null || approvedMentionIds?.has(key);
                return (
                  <MentionRow
                    key={`${key}-${i}`}
                    mention={mention}
                    index={i}
                    isApproved={isApproved}
                    onApprove={() => onApproveMention(mention)}
                    onReject={(addToIgnore) => onRejectMention(mention, addToIgnore)}
                    onUndo={
                      isApproved && onUndoMention
                        ? () => onUndoMention(mention)
                        : undefined
                    }
                    onShowThinking={
                      (aiResponse?.thinking || mention.reasoning) && onShowThinking
                        ? () =>
                            onShowThinking(
                              mention.reasoning || aiResponse?.thinking || "",
                              mention.vendor_name
                            )
                        : undefined
                    }
                  />
                );
              })}
            </div>
          ) : item.status === "processed" ? (
            <p className="text-xs text-zinc-600 italic">No mentions extracted from this conversation.</p>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default QueueItemCard;
