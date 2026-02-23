import { useState, useRef, useEffect } from "react";
import { X, Sparkles, AlertCircle, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatMarkdown } from "./ChatMarkdown";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface InlineAIChatProps {
  /** The initial query that triggered the chat (set externally). */
  initialQuery: string | null;
  /** Monotonically increasing ID to distinguish repeated queries. */
  queryId: number;
  /** Called when the user dismisses the chat. */
  onClose: () => void;
  className?: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vendor-ai-chat`;

export function InlineAIChat({ initialQuery, queryId, onClose, className }: InlineAIChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [followUpInput, setFollowUpInput] = useState("");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);
  const followUpInputRef = useRef<HTMLInputElement>(null);
  const lastProcessedQueryIdRef = useRef<number>(0);
  const messagesRef = useRef<Message[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  // Keep messagesRef in sync with messages state
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Auto-scroll only within the chat container (not the whole page),
  // and only if the user hasn't manually scrolled up.
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || userScrolledRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Abort in-flight request on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // When queryId advances, send the new initial query
  useEffect(() => {
    if (initialQuery && queryId > lastProcessedQueryIdRef.current) {
      lastProcessedQueryIdRef.current = queryId;
      sendMessage(initialQuery);
    }
  }, [queryId, initialQuery]);

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    // Abort any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const userMessage: Message = { role: "user", content: messageText.trim() };
    const updatedMessages = [...messagesRef.current, userMessage];
    const messageCountBeforeSend = messagesRef.current.length;
    setMessages(updatedMessages);
    setIsLoading(true);
    userScrolledRef.current = false;
    setError(null);

    let assistantContent = "";

    const updateAssistant = (chunk: string) => {
      assistantContent += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: assistantContent } : m
          );
        }
        return [...prev, { role: "assistant", content: assistantContent }];
      });
    };

    try {
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ messages: updatedMessages }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed: ${response.status}`);
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done || streamDone) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) updateAssistant(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (err) {
      // Ignore abort errors (user closed chat)
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("Chat error:", err);
      setError(err instanceof Error ? err.message : "Failed to send message");
      // Remove user message and any partial assistant content
      setMessages((prev) => prev.slice(0, messageCountBeforeSend));
    } finally {
      setIsLoading(false);
    }
  };

  const handleFollowUpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (followUpInput.trim() && !isLoading) {
      sendMessage(followUpInput.trim());
      setFollowUpInput("");
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className={cn(
          "bg-white rounded-2xl overflow-hidden",
          "shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_4px_24px_-4px_rgba(0,0,0,0.08),0_12px_48px_-8px_rgba(0,0,0,0.06)]",
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-black/[0.04] bg-gradient-to-r from-amber-50/80 to-transparent">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center h-6 w-6 rounded-lg bg-amber-100">
              <Sparkles className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <span className="text-[13px] font-semibold text-foreground/80 tracking-tight">AI Vendor Advisor</span>
            {isLoading && (
              <span className="text-[11px] text-amber-600/70 font-medium">Thinking...</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-lg text-foreground/25 hover:text-foreground/60 hover:bg-black/[0.04] transition-all"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Messages */}
        <div
          ref={scrollContainerRef}
          onScroll={() => {
            const el = scrollContainerRef.current;
            if (!el) return;
            const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
            userScrolledRef.current = !atBottom;
          }}
          className="max-h-[60vh] sm:max-h-[420px] overflow-y-auto px-5 py-4 space-y-4"
        >
          {messages.map((message, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: message.role === "assistant" ? 0 : 0.05 }}
              className={cn(
                "flex",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {message.role === "user" ? (
                <div className="max-w-[85%] bg-foreground text-white rounded-2xl rounded-br-md px-4 py-2.5">
                  <p className="text-[14px] leading-relaxed">{message.content}</p>
                </div>
              ) : (
                <div className="max-w-[90%] w-full">
                  <div className="prose prose-sm max-w-none text-foreground/85 [&_p]:leading-relaxed [&_p]:mb-2 [&_p:last-child]:mb-0 [&_a]:text-amber-600 [&_a]:no-underline [&_a]:hover:underline [&_li]:text-foreground/75 [&_strong]:text-foreground [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm">
                    <ChatMarkdown content={message.content} />
                  </div>
                </div>
              )}
            </motion.div>
          ))}

          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="flex items-center gap-1.5 px-3 py-2">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" style={{ animationDelay: "0ms" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" style={{ animationDelay: "150ms" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" style={{ animationDelay: "300ms" }} />
              </div>
            </motion.div>
          )}
        </div>

        {/* Follow-up input */}
        {messages.length > 0 && (
          <form
            onSubmit={handleFollowUpSubmit}
            className="px-4 py-3 border-t border-black/[0.04] bg-[hsl(40,20%,98%)]"
          >
            <div className="flex items-center gap-2">
              <input
                ref={followUpInputRef}
                type="text"
                value={followUpInput}
                onChange={(e) => setFollowUpInput(e.target.value)}
                placeholder="Ask a follow-up..."
                disabled={isLoading}
                className="flex-1 bg-white rounded-xl px-3.5 py-2 text-sm outline-none border border-black/[0.06] focus:border-amber-300 transition-colors placeholder:text-foreground/25"
              />
              <button
                type="submit"
                disabled={isLoading || !followUpInput.trim()}
                className={cn(
                  "h-8 w-8 flex items-center justify-center rounded-xl transition-all",
                  followUpInput.trim() && !isLoading
                    ? "bg-foreground text-white hover:bg-foreground/80"
                    : "bg-black/[0.04] text-foreground/20"
                )}
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </form>
        )}

        {/* Error */}
        {error && (
          <div className="px-5 py-2.5 bg-red-50 border-t border-red-100">
            <div className="flex items-center gap-2 text-red-600 text-[13px]">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
