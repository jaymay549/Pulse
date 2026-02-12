import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Plus,
  History,
  Upload,
  FileText,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useWamApi } from "@/hooks/useWamApi";
import { useAdminGroups } from "@/hooks/useAdminGroups";
import { fetchConversation, fetchChatStatus } from "@/hooks/useAdminData";
import GroupSelectionTable from "./GroupSelectionTable";
import ChatMessageBubble from "./ChatMessageBubble";
import ChatHistory from "./ChatHistory";
import DateRangeSelector from "./DateRangeSelector";
import PdfPreviewDialog from "./PdfPreviewDialog";
import type {
  ChatMessage,
  ChatConversation,
  DateRangePreset,
  WhatsAppGroup,
} from "@/types/admin";

const MAX_POLL_ATTEMPTS = 60;
const POLL_INTERVAL = 1000;
const MAX_AUTO_RETRIES = 3;

const RETRYABLE_STATUSES = new Set([408, 504, 503, 429]);

interface UploadedFile {
  name: string;
  content: string;
}

interface AIChatBoxProps {
  initialChatId?: number | null;
  onChatIdChange?: (id: number | null) => void;
}

const AIChatBox = ({ initialChatId, onChatIdChange }: AIChatBoxProps) => {
  const wam = useWamApi();
  const { data: groups = [] } = useAdminGroups();

  // Core state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [contextGroupIds, setContextGroupIds] = useState<number[]>([]);
  const [groupsLocked, setGroupsLocked] = useState(false);

  // Date range
  const [dateRangePreset, setDateRangePreset] =
    useState<DateRangePreset>("last7days");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  // File uploads
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Conversation persistence
  const [currentConversationId, setCurrentConversationId] = useState<
    number | null
  >(initialChatId || null);
  const [showHistory, setShowHistory] = useState(false);

  // PDF
  const [previewPdfId, setPreviewPdfId] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Auto-select monitored groups
  useEffect(() => {
    if (groups.length > 0 && contextGroupIds.length === 0 && !groupsLocked) {
      const monitored = groups.filter((g) => g.is_monitored).map((g) => g.id);
      if (monitored.length > 0) setContextGroupIds(monitored);
    }
  }, [groups]);

  // Load conversation from initialChatId
  useEffect(() => {
    if (initialChatId) loadConversation(initialChatId);
  }, [initialChatId]);

  const getDateRange = useCallback(() => {
    const now = new Date();
    if (dateRangePreset === "last1day") {
      const start = new Date(now);
      start.setDate(start.getDate() - 1);
      return { startDate: start.toISOString(), endDate: now.toISOString() };
    }
    if (dateRangePreset === "last7days") {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      return { startDate: start.toISOString(), endDate: now.toISOString() };
    }
    if (dateRangePreset === "custom" && customStartDate && customEndDate) {
      return {
        startDate: new Date(customStartDate).toISOString(),
        endDate: new Date(customEndDate).toISOString(),
      };
    }
    return {};
  }, [dateRangePreset, customStartDate, customEndDate]);

  const pollForResponse = async (requestId: number): Promise<string> => {
    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL));
      const status = await fetchChatStatus(requestId);
      if (status.status === "completed") return status.response;
      if (status.status === "failed") throw new Error(status.error || "AI request failed");
    }
    throw new Error("Request timed out after 60 seconds");
  };

  const generatePdfForMessage = async (
    content: string,
    messageIndex: number
  ) => {
    setMessages((prev) => {
      const updated = [...prev];
      if (updated[messageIndex]) {
        updated[messageIndex] = {
          ...updated[messageIndex],
          pdfStatus: "generating",
        };
      }
      return updated;
    });

    try {
      const groupNames = groups
        .filter((g) => contextGroupIds.includes(g.id))
        .map((g) => g.name);
      const dateRange = getDateRange();
      const title = groupNames.length > 0
        ? groupNames.join(", ")
        : uploadedFiles.map((f) => f.name).join(", ") || "AI Chat Export";

      const result = await wam.generatePdf({
        summaryContent: content,
        groupIds: contextGroupIds,
        title,
        ...dateRange,
      });

      setMessages((prev) => {
        const updated = [...prev];
        if (updated[messageIndex]) {
          updated[messageIndex] = {
            ...updated[messageIndex],
            pdfId: result.id,
            pdfStatus: "success",
          };
        }
        return updated;
      });
    } catch (e: any) {
      setMessages((prev) => {
        const updated = [...prev];
        if (updated[messageIndex]) {
          updated[messageIndex] = {
            ...updated[messageIndex],
            pdfStatus: "error",
            pdfError: e?.message || "PDF generation failed",
          };
        }
        return updated;
      });
    }
  };

  const autoSaveConversation = async (
    updatedMessages: ChatMessage[]
  ) => {
    const completedMessages = updatedMessages
      .filter((m) => !m.error && m.content)
      .map((m) => ({ role: m.role, content: m.content }));

    if (completedMessages.length === 0) return;

    const groupNames = groups
      .filter((g) => contextGroupIds.includes(g.id))
      .map((g) => g.name);
    const pdfIds = updatedMessages
      .filter((m) => m.pdfId)
      .map((m) => m.pdfId!);

    try {
      const result = await wam.saveConversation({
        id: currentConversationId || undefined,
        title:
          groupNames.length > 0
            ? `Chat: ${groupNames.slice(0, 2).join(", ")}${groupNames.length > 2 ? "..." : ""}`
            : "AI Chat",
        groupIds: contextGroupIds,
        groupNames,
        messages: completedMessages,
        contextGroupIds,
        dateRangePreset,
        customStartDate: customStartDate || undefined,
        customEndDate: customEndDate || undefined,
        pdfIds,
      });

      if (result.id && !currentConversationId) {
        setCurrentConversationId(result.id);
        onChatIdChange?.(result.id);
      }
    } catch {
      // Silent fail for auto-save
    }
  };

  const sendMessage = async (retryIndex?: number) => {
    const userText = retryIndex !== undefined ? "" : input.trim();
    if (retryIndex === undefined && !userText) return;

    if (!groupsLocked) setGroupsLocked(true);
    if (retryIndex === undefined) setInput("");

    // Build messages array
    let newMessages: ChatMessage[];
    if (retryIndex !== undefined) {
      // Retry: remove the failed message and re-send
      newMessages = [...messages];
      const failedMsg = newMessages[retryIndex];
      newMessages[retryIndex] = {
        ...failedMsg,
        error: undefined,
        canRetry: undefined,
        retryCount: (failedMsg.retryCount || 0) + 1,
      };
    } else {
      const userMsg: ChatMessage = {
        type: "message",
        role: "user",
        content: userText,
      };
      const assistantMsg: ChatMessage = {
        type: "message",
        role: "assistant",
        content: "",
      };
      newMessages = [...messages, userMsg, assistantMsg];
    }

    setMessages(newMessages);
    setLoading(true);

    const assistantIndex =
      retryIndex !== undefined ? retryIndex : newMessages.length - 1;

    try {
      // Build conversation history for API
      const conversationHistory = newMessages
        .slice(0, assistantIndex)
        .filter((m) => m.content && !m.error)
        .map((m) => ({ role: m.role, content: m.content }));

      const lastUserMsg =
        retryIndex !== undefined
          ? conversationHistory[conversationHistory.length - 1]?.content || ""
          : userText;

      const dateRange = getDateRange();

      const result = await wam.chatWithAI({
        groupIds: contextGroupIds,
        messages: conversationHistory,
        userMessage: lastUserMsg,
        ...dateRange,
        uploadedFiles:
          uploadedFiles.length > 0 ? uploadedFiles : undefined,
      });

      const response = await pollForResponse(result.requestId);

      const updatedMessages = [...newMessages];
      updatedMessages[assistantIndex] = {
        type: "message",
        role: "assistant",
        content: response,
      };
      setMessages(updatedMessages);
      setLoading(false);

      // Auto-generate PDF
      generatePdfForMessage(response, assistantIndex);

      // Auto-save conversation
      setTimeout(() => autoSaveConversation(updatedMessages), 100);
    } catch (e: any) {
      const status = e?.status;
      const isRetryable = RETRYABLE_STATUSES.has(status) || !status;
      const currentRetry = newMessages[assistantIndex]?.retryCount || 0;

      if (isRetryable && currentRetry < MAX_AUTO_RETRIES) {
        // Auto-retry
        const delay = Math.min(1000 * Math.pow(2, currentRetry), 10000);
        const updatedMessages = [...newMessages];
        updatedMessages[assistantIndex] = {
          type: "message",
          role: "assistant",
          content: "",
          retryCount: currentRetry + 1,
        };
        setMessages(updatedMessages);
        setTimeout(() => sendMessage(assistantIndex), delay);
        return;
      }

      const updatedMessages = [...newMessages];
      updatedMessages[assistantIndex] = {
        type: "message",
        role: "assistant",
        content: "",
        error:
          e?.error?.error ||
          e?.message ||
          "Something went wrong",
        canRetry: isRetryable,
        retryCount: currentRetry,
      };
      setMessages(updatedMessages);
      setLoading(false);
    }
  };

  const loadConversation = async (id: number) => {
    try {
      const conv = await fetchConversation(id);
      setMessages(
        conv.messages.map((m) => ({
          type: "message" as const,
          role: m.role as "user" | "assistant",
          content: m.content,
        }))
      );
      setContextGroupIds(conv.context_group_ids || conv.group_ids || []);
      setGroupsLocked(true);
      setCurrentConversationId(conv.id);
      setDateRangePreset(
        (conv.date_range_preset as DateRangePreset) || "last7days"
      );
      if (conv.custom_start_date) setCustomStartDate(conv.custom_start_date);
      if (conv.custom_end_date) setCustomEndDate(conv.custom_end_date);
      onChatIdChange?.(conv.id);
    } catch {
      // ignore
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setGroupsLocked(false);
    setInput("");
    setUploadedFiles([]);
    setCurrentConversationId(null);
    onChatIdChange?.(null);
    setDateRangePreset("last7days");
    setCustomStartDate("");
    setCustomEndDate("");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (!file.name.endsWith(".txt")) return;
      const reader = new FileReader();
      reader.onload = () => {
        setUploadedFiles((prev) => [
          ...prev,
          { name: file.name, content: reader.result as string },
        ]);
      };
      reader.readAsText(file);
    });
    e.target.value = "";
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const selectedGroupNames = groups
    .filter((g) => contextGroupIds.includes(g.id))
    .map((g) => g.name);

  // ── Group Selection Phase ──
  if (!groupsLocked && messages.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-200">
            Select groups to chat with
          </h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHistory(true)}
              className="text-xs bg-zinc-900 border-zinc-700 text-zinc-300"
            >
              <History className="h-3.5 w-3.5 mr-1" />
              History
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <GroupSelectionTable
            groups={groups as WhatsAppGroup[]}
            selectedIds={contextGroupIds}
            onSelectionChange={setContextGroupIds}
            onStartChat={() => {
              setGroupsLocked(true);
              inputRef.current?.focus();
            }}
          />
        </div>
        <ChatHistory
          open={showHistory}
          onOpenChange={setShowHistory}
          onLoadConversation={(conv) => loadConversation(conv.id)}
          currentConversationId={currentConversationId}
        />
      </div>
    );
  }

  // ── Chat Phase ──
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b border-zinc-800 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
          {selectedGroupNames.slice(0, 3).map((name) => (
            <span
              key={name}
              className="text-xs px-2 py-1 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 truncate max-w-[150px]"
            >
              {name}
            </span>
          ))}
          {selectedGroupNames.length > 3 && (
            <span className="text-xs text-zinc-500">
              +{selectedGroupNames.length - 3} more
            </span>
          )}
          {uploadedFiles.length > 0 && (
            <span className="text-xs px-2 py-1 rounded-full bg-blue-900/30 text-blue-400 border border-blue-800">
              <FileText className="h-3 w-3 inline mr-1" />
              {uploadedFiles.length} file(s)
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <DateRangeSelector
            preset={dateRangePreset}
            onPresetChange={setDateRangePreset}
            customStart={customStartDate}
            customEnd={customEndDate}
            onCustomStartChange={setCustomStartDate}
            onCustomEndChange={setCustomEndDate}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt"
            multiple
            className="hidden"
            onChange={handleFileUpload}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="text-xs h-8 bg-zinc-900 border-zinc-700 text-zinc-400"
          >
            <Upload className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHistory(true)}
            className="text-xs h-8 bg-zinc-900 border-zinc-700 text-zinc-400"
          >
            <History className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNewChat}
            className="text-xs h-8 bg-zinc-900 border-zinc-700 text-zinc-400"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Uploaded files pills */}
      {uploadedFiles.length > 0 && (
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-zinc-800 flex-wrap">
          {uploadedFiles.map((f, i) => (
            <span
              key={i}
              className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-300 flex items-center gap-1"
            >
              <FileText className="h-3 w-3" />
              {f.name}
              <button
                onClick={() =>
                  setUploadedFiles((prev) =>
                    prev.filter((_, j) => j !== i)
                  )
                }
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        {messages.map((msg, i) => (
          <ChatMessageBubble
            key={i}
            message={msg}
            isLoading={loading && msg.role === "assistant" && !msg.content && !msg.error}
            onRetry={() => sendMessage(i)}
            onViewPdf={(id) => setPreviewPdfId(id)}
            onGeneratePdf={(content) => generatePdfForMessage(content, i)}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-zinc-800 p-3">
        <div className="flex items-end gap-2">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={loading}
            rows={2}
            className="resize-none bg-zinc-900 border-zinc-700 text-zinc-200 text-sm min-h-[60px]"
          />
          <Button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            size="sm"
            className="h-10 w-10 bg-blue-600 hover:bg-blue-700 flex-shrink-0"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Modals */}
      <ChatHistory
        open={showHistory}
        onOpenChange={setShowHistory}
        onLoadConversation={(conv) => loadConversation(conv.id)}
        currentConversationId={currentConversationId}
      />
      <PdfPreviewDialog
        open={previewPdfId !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewPdfId(null);
        }}
        pdfId={previewPdfId}
      />
    </div>
  );
};

export default AIChatBox;
