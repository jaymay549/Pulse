import { useState } from "react";
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  FileText,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChatMessage } from "@/types/admin";

const TRUNCATION_THRESHOLD = 300;

interface ChatMessageBubbleProps {
  message: ChatMessage;
  isLoading?: boolean;
  onRetry?: () => void;
  onViewPdf?: (pdfId: number) => void;
  onGeneratePdf?: (content: string) => void;
}

const ChatMessageBubble = ({
  message,
  isLoading,
  onRetry,
  onViewPdf,
  onGeneratePdf,
}: ChatMessageBubbleProps) => {
  const [expanded, setExpanded] = useState(false);
  const isUser = message.role === "user";
  const needsTruncation =
    !expanded && message.content.length > TRUNCATION_THRESHOLD;
  const displayContent = needsTruncation
    ? message.content.slice(0, TRUNCATION_THRESHOLD) + "..."
    : message.content;

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}
    >
      <div
        className={`max-w-[80%] rounded-lg px-4 py-3 text-sm ${
          isUser
            ? "bg-blue-600 text-white"
            : "bg-zinc-800 text-zinc-200 border border-zinc-700"
        }`}
      >
        {isLoading ? (
          <div className="flex items-center gap-2 text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>AI is thinking...</span>
            {message.retryCount && message.retryCount > 0 && (
              <span className="text-xs text-zinc-500">
                (Retry {message.retryCount})
              </span>
            )}
          </div>
        ) : message.error ? (
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-red-400">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span className="text-xs">{message.error}</span>
            </div>
            {message.canRetry && onRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="text-xs h-7 border-zinc-600 text-zinc-300"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="whitespace-pre-wrap break-words">
              {displayContent}
            </div>
            {message.content.length > TRUNCATION_THRESHOLD && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-blue-400 hover:text-blue-300 mt-1 flex items-center gap-1"
              >
                {expanded ? (
                  <>
                    <ChevronUp className="h-3 w-3" /> Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3" /> Show more
                  </>
                )}
              </button>
            )}

            {/* PDF status */}
            {!isUser && message.pdfStatus === "generating" && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-zinc-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                Generating PDF...
              </div>
            )}
            {!isUser && message.pdfStatus === "success" && message.pdfId && (
              <div className="mt-2 flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onViewPdf?.(message.pdfId!)}
                  className="text-xs h-7 border-zinc-600 text-zinc-300"
                >
                  <Eye className="h-3 w-3 mr-1" />
                  View PDF
                </Button>
              </div>
            )}
            {!isUser && message.pdfStatus === "error" && (
              <div className="mt-2 text-xs text-red-400 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                PDF generation failed
                {message.pdfError && `: ${message.pdfError}`}
              </div>
            )}

            {/* Generate PDF button for assistant messages without PDF */}
            {!isUser &&
              !message.pdfStatus &&
              !message.error &&
              message.content && (
                <div className="mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onGeneratePdf?.(message.content)}
                    className="text-xs h-7 text-zinc-500 hover:text-zinc-300"
                  >
                    <FileText className="h-3 w-3 mr-1" />
                    Generate PDF
                  </Button>
                </div>
              )}
          </>
        )}
      </div>
    </div>
  );
};

export default ChatMessageBubble;
