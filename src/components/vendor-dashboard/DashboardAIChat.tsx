import { useState, useRef, useEffect } from "react";
import { Sparkles, X, Send, AlertCircle, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { ChatMarkdown } from "@/components/vendors/ChatMarkdown";
import type { VendorDashboardIntel } from "@/hooks/useVendorIntelligenceDashboard";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vendor-ai-chat`;

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface DashboardAIChatProps {
  vendorName: string;
  dashboardIntel: VendorDashboardIntel | null;
}

const QUICK_ASKS = [
  { label: "Summarize my performance", icon: "📊" },
  { label: "What should I focus on improving?", icon: "🎯" },
  { label: "Explain my health score", icon: "💡" },
  { label: "How do I compare to my category?", icon: "📈" },
];

function buildDashboardContext(intel: VendorDashboardIntel) {
  const metrics: Record<string, { score: number | null; mention_count?: number; sentiment_ratio?: number; velocity_score?: number }> = {};

  if (intel.metrics) {
    for (const key of ["product_stability", "customer_experience", "value_perception"] as const) {
      const m = intel.metrics[key];
      metrics[key] = {
        score: m.score,
        mention_count: m.data?.mention_count,
        sentiment_ratio: m.data?.sentiment_ratio,
        velocity_score: m.data?.velocity_score,
      };
    }
  }

  return [
    {
      name: intel.vendor_name,
      category: intel.category || "",
      positiveCount: 0,
      warningCount: 0,
      mentions: [],
      dashboardIntel: {
        health_score: intel.metrics?.health_score ?? null,
        metrics,
        benchmarks: intel.benchmarks,
        percentiles: intel.percentiles,
        recommendations: intel.recommendations.slice(0, 5).map((r) => ({
          priority: r.priority,
          category: r.category,
          metric_affected: r.metric_affected || "",
          insight_text: r.insight_text || "",
        })),
        feature_gaps: intel.feature_gaps.slice(0, 10).map((g) => ({
          gap_label: g.gap_label,
          mention_count: g.mention_count,
          trend_direction: g.trend_direction,
        })),
        sentiment_history: intel.sentiment_history,
      },
    },
  ];
}

export function DashboardAIChat({ vendorName, dashboardIntel }: DashboardAIChatProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<Message[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || userScrolledRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Abort on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Focus input when panel opens
  useEffect(() => {
    if (open && messages.length > 0) {
      inputRef.current?.focus();
    }
  }, [open]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const userMsg: Message = { role: "user", content: text.trim() };
    const updated = [...messagesRef.current, userMsg];
    const prevCount = messagesRef.current.length;

    setMessages(updated);
    setIsLoading(true);
    setError(null);
    setInput("");
    userScrolledRef.current = false;

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
      const vendorData = dashboardIntel
        ? buildDashboardContext(dashboardIntel)
        : [{ name: vendorName, category: "", positiveCount: 0, warningCount: 0, mentions: [] }];

      const res = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ messages: updated, vendorData }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Request failed: ${res.status}`);
      }
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) updateAssistant(c);
          } catch {
            break;
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("Dashboard chat error:", err);
      setError(err instanceof Error ? err.message : "Failed to send message");
      setMessages((prev) => prev.slice(0, prevCount));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <>
      {/* FAB */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg hover:bg-slate-800 transition-colors"
            title="Ask AI about your data"
          >
            <Sparkles className="h-5 w-5" />
            {messages.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-white" />
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className={cn(
              "fixed z-50 flex flex-col bg-white rounded-2xl overflow-hidden",
              "shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_8px_32px_-4px_rgba(0,0,0,0.12),0_16px_64px_-8px_rgba(0,0,0,0.08)]",
              // Desktop
              "bottom-5 right-5 w-[400px] max-h-[560px]",
              // Mobile
              "max-sm:inset-x-3 max-sm:bottom-3 max-sm:top-16 max-sm:w-auto max-sm:max-h-none"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-transparent">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900">
                  <Sparkles className="h-3.5 w-3.5 text-white" />
                </div>
                <div>
                  <span className="text-[13px] font-semibold text-slate-900 tracking-tight">
                    AI Data Advisor
                  </span>
                  {isLoading && (
                    <span className="ml-2 text-[11px] text-slate-400 font-medium">
                      Thinking...
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              onScroll={() => {
                const el = scrollRef.current;
                if (!el) return;
                const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
                userScrolledRef.current = !atBottom;
              }}
              className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
            >
              {messages.length === 0 ? (
                /* Quick-ask chips */
                <div className="flex flex-col items-center justify-center h-full py-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 mb-3">
                    <MessageSquare className="h-6 w-6 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-700 mb-1">
                    Ask about your data
                  </p>
                  <p className="text-xs text-slate-400 mb-5 text-center max-w-[260px]">
                    Get instant insights about your performance, metrics, and dealer feedback
                  </p>
                  <div className="w-full space-y-2">
                    {QUICK_ASKS.map((q) => (
                      <button
                        key={q.label}
                        onClick={() => sendMessage(q.label)}
                        disabled={isLoading}
                        className="w-full flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left text-[13px] text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50"
                      >
                        <span className="text-base">{q.icon}</span>
                        {q.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className={cn(
                        "flex",
                        msg.role === "user" ? "justify-end" : "justify-start"
                      )}
                    >
                      {msg.role === "user" ? (
                        <div className="max-w-[85%] bg-slate-900 text-white rounded-2xl rounded-br-md px-4 py-2.5">
                          <p className="text-[13px] leading-relaxed">{msg.content}</p>
                        </div>
                      ) : (
                        <div className="max-w-[92%] w-full">
                          <ChatMarkdown content={msg.content} />
                        </div>
                      )}
                    </motion.div>
                  ))}

                  {/* Typing indicator */}
                  {isLoading && messages[messages.length - 1]?.role === "user" && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex justify-start"
                    >
                      <div className="flex items-center gap-1.5 px-3 py-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-pulse" style={{ animationDelay: "0ms" }} />
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-pulse" style={{ animationDelay: "150ms" }} />
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-pulse" style={{ animationDelay: "300ms" }} />
                      </div>
                    </motion.div>
                  )}
                </>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="px-4 py-2 bg-red-50 border-t border-red-100">
                <div className="flex items-center gap-2 text-red-600 text-[12px]">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {error}
                </div>
              </div>
            )}

            {/* Input */}
            <form
              onSubmit={handleSubmit}
              className="px-3 py-3 border-t border-slate-100 bg-slate-50/50"
            >
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={messages.length === 0 ? "Ask anything about your data..." : "Ask a follow-up..."}
                  disabled={isLoading}
                  className="flex-1 bg-white rounded-xl px-3.5 py-2 text-sm outline-none border border-slate-200 focus:border-slate-400 transition-colors placeholder:text-slate-400"
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className={cn(
                    "h-8 w-8 flex items-center justify-center rounded-xl transition-all",
                    input.trim() && !isLoading
                      ? "bg-slate-900 text-white hover:bg-slate-800"
                      : "bg-slate-100 text-slate-300"
                  )}
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
