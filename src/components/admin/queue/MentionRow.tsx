import { useState } from "react";
import { Check, X, Undo2, Brain, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VENDOR_DIMENSIONS, SENTIMENT_COLORS } from "@/types/admin";
import type { QueueItemMention } from "@/types/admin";

interface MentionRowProps {
  mention: QueueItemMention;
  index: number;
  onApprove: () => Promise<void>;
  onReject: (addToIgnore: boolean) => void;
  onUndo?: () => Promise<void>;
  onShowThinking?: () => void;
  isApproved?: boolean;
  isProcessing?: boolean;
}

const MentionRow = ({
  mention,
  onApprove,
  onReject,
  onUndo,
  onShowThinking,
  isApproved,
  isProcessing,
}: MentionRowProps) => {
  const [localProcessing, setLocalProcessing] = useState(false);

  const sentimentClass =
    SENTIMENT_COLORS[mention.sentiment] || SENTIMENT_COLORS.unknown;
  const dimensionInfo =
    VENDOR_DIMENSIONS[mention.dimension] || VENDOR_DIMENSIONS.other;

  const handleApprove = async () => {
    setLocalProcessing(true);
    try {
      await onApprove();
    } finally {
      setLocalProcessing(false);
    }
  };

  const handleUndo = async () => {
    if (!onUndo) return;
    setLocalProcessing(true);
    try {
      await onUndo();
    } finally {
      setLocalProcessing(false);
    }
  };

  const busy = isProcessing || localProcessing;

  return (
    <div className="border border-zinc-800 rounded-lg p-3 space-y-2 bg-zinc-900/50">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="font-semibold text-zinc-100 text-sm">
            {mention.vendor_name}
          </span>
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 ${sentimentClass}`}
          >
            {mention.sentiment}
          </Badge>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-zinc-400 border-zinc-700">
            {dimensionInfo.label}
          </Badge>
          {mention.category && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-zinc-500 border-zinc-700">
              {mention.category}
            </Badge>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {onShowThinking && mention.reasoning && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-zinc-500 hover:text-amber-400"
              onClick={onShowThinking}
            >
              <Brain className="h-3.5 w-3.5" />
            </Button>
          )}

          {isApproved ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-green-500 hover:text-amber-400"
              onClick={handleUndo}
              disabled={busy}
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Undo2 className="h-3.5 w-3.5" />
              )}
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-zinc-500 hover:text-green-400"
                onClick={handleApprove}
                disabled={busy}
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-zinc-500 hover:text-red-400"
                onClick={() => onReject(false)}
                disabled={busy}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Headline */}
      {mention.headline && (
        <p className="text-xs font-medium text-zinc-300">{mention.headline}</p>
      )}

      {/* Snippet */}
      <p className="text-xs text-zinc-500 leading-relaxed">
        {mention.snippet_anon}
      </p>
    </div>
  );
};

export default MentionRow;
