import { useState } from "react";
import { Play, Send, Loader2, AlertCircle, Pencil, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import HtmlEditorModal from "./HtmlEditorModal";
import type { TaskOccurrence } from "@/types/admin";

interface OccurrenceRowProps {
  occurrence: TaskOccurrence;
  onTriggerGenerate: () => Promise<void>;
  onTriggerSend: () => Promise<void>;
  onReject?: () => Promise<void>;
  onSend?: () => Promise<void>;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "text-blue-400 border-blue-800 bg-blue-900/20",
  generating: "text-yellow-400 border-yellow-800 bg-yellow-900/20",
  ready: "text-green-400 border-green-800 bg-green-900/20",
  sending: "text-purple-400 border-purple-800 bg-purple-900/20",
  sent: "text-zinc-400 border-zinc-700 bg-zinc-900/20",
  failed: "text-red-400 border-red-800 bg-red-900/20",
  rejected: "text-zinc-500 border-zinc-700 bg-zinc-900/20",
  cancelled: "text-zinc-500 border-zinc-700 bg-zinc-900/20",
};

const OccurrenceRow = ({
  occurrence,
  onTriggerGenerate,
  onTriggerSend,
  onReject,
  onSend,
}: OccurrenceRowProps) => {
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [showHtmlEditor, setShowHtmlEditor] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await onTriggerGenerate();
    } finally {
      setGenerating(false);
    }
  };

  const handleSend = async () => {
    setSending(true);
    try {
      if (onSend) await onSend();
      else await onTriggerSend();
    } finally {
      setSending(false);
    }
  };

  const handleReject = async () => {
    if (!onReject || !confirm("Reject this occurrence?")) return;
    setRejecting(true);
    try {
      await onReject();
    } finally {
      setRejecting(false);
    }
  };

  const statusClass = STATUS_COLORS[occurrence.status] || STATUS_COLORS.pending;

  return (
    <>
      <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-900/40 transition-colors">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusClass}`}>
              {occurrence.status}
            </Badge>
            <span className="text-[10px] text-zinc-500">
              Gen: {new Date(occurrence.generate_at).toLocaleString("en-GB", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <span className="text-[10px] text-zinc-600">
              Send: {new Date(occurrence.send_at).toLocaleString("en-GB", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            {occurrence.edited_html && (
              <span className="text-[9px] text-amber-500">edited</span>
            )}
          </div>
          {occurrence.error && (
            <div className="flex items-center gap-1 mt-0.5 text-[10px] text-red-400">
              <AlertCircle className="h-3 w-3" />
              {occurrence.error}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          {(occurrence.status === "pending" || occurrence.status === "failed") && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-1.5 text-zinc-500 hover:text-green-400"
              onClick={handleGenerate}
              disabled={generating}
              title="Trigger generation"
            >
              {generating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Play className="h-3 w-3" />
              )}
            </Button>
          )}
          {occurrence.status === "ready" && (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-1.5 text-zinc-500 hover:text-amber-400"
                onClick={() => setShowHtmlEditor(true)}
                title="Edit HTML"
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-1.5 text-zinc-500 hover:text-blue-400"
                onClick={handleSend}
                disabled={sending}
                title="Send"
              >
                {sending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Send className="h-3 w-3" />
                )}
              </Button>
            </>
          )}
          {(occurrence.status === "ready" || occurrence.status === "pending") && onReject && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-1.5 text-zinc-500 hover:text-red-400"
              onClick={handleReject}
              disabled={rejecting}
              title="Reject"
            >
              {rejecting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <XCircle className="h-3 w-3" />
              )}
            </Button>
          )}
        </div>
      </div>

      <HtmlEditorModal
        open={showHtmlEditor}
        onOpenChange={setShowHtmlEditor}
        occurrenceId={occurrence.id}
      />
    </>
  );
};

export default OccurrenceRow;
