import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { MessageCircle, X, Send, Loader2, Sparkles, AlertCircle, Mic, MicOff, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { WAM_URL } from "@/config/wam";
import { ChatMarkdown } from "./ChatMarkdown";
import { useVoiceChat, VoiceState } from "@/hooks/useVoiceChat";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface VendorData {
  name: string;
  category: string;
  positiveCount: number;
  warningCount: number;
  mentions: {
    title: string;
    type: "positive" | "warning";
    quote: string;
  }[];
}

interface VendorAIChatProps {
  fetchWithAuth: (url: string) => Promise<Response>;
  className?: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vendor-ai-chat`;

const SUGGESTED_PROMPTS = [
  "What DMS should I use for a mid-size dealership?",
  "Compare Cox Automotive vs CDK",
  "Which vendors have the most warnings?",
  "What problems can Tekion solve for me?",
  "Best CRM for customer follow-up?",
];

export const VendorAIChat: React.FC<VendorAIChatProps> = ({
  fetchWithAuth,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Vendor data loading state
  const [vendorData, setVendorData] = useState<VendorData[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [dataLoaded, setDataLoaded] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Voice chat handler - returns AI response for TTS
  const handleVoiceTranscript = useCallback(async (text: string): Promise<string | undefined> => {
    if (!text.trim() || !dataLoaded) return undefined;

    const userMessage: Message = { role: "user", content: text.trim() };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    let fullResponse = "";

    const updateAssistant = (chunk: string) => {
      fullResponse += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => 
            i === prev.length - 1 ? { ...m, content: fullResponse } : m
          );
        }
        return [...prev, { role: "assistant", content: fullResponse }];
      });
    };

    try {
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          vendorData,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed: ${response.status}`);
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

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

      return fullResponse;
    } catch (err) {
      console.error("Chat error:", err);
      setError(err instanceof Error ? err.message : "Failed to send message");
      setMessages(prev => prev.slice(0, -1));
      return undefined;
    } finally {
      setIsLoading(false);
    }
  }, [messages, vendorData, dataLoaded]);

  // Voice chat hook
  const { voiceState, partialTranscript, startVoice, stopVoice } = useVoiceChat({
    onTranscriptComplete: handleVoiceTranscript,
    enabled: dataLoaded,
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load all vendor data when chat opens
  const loadVendorData = useCallback(async () => {
    if (dataLoaded || isLoadingData) return;
    
    setIsLoadingData(true);
    setLoadingProgress(0);
    setError(null);

    try {
      // Fetch all categories to get comprehensive data
      const categories = [
        "all", "dms", "crm", "fi", "marketing", "fixed-ops", 
        "inventory", "digital-retail", "data", "chat", "websites", "reputation"
      ];
      
      const allVendorData: Map<string, VendorData> = new Map();
      
      for (let i = 0; i < categories.length; i++) {
        const category = categories[i];
        setLoadingProgress(Math.round(((i + 1) / categories.length) * 100));
        
        try {
          const params = new URLSearchParams();
          if (category !== "all") params.append("category", category);
          params.append("pageSize", "100");
          
          const response = await fetchWithAuth(
            `${WAM_URL}/api/public/vendor-pulse/mentions?${params.toString()}`
          );
          
          if (response.ok) {
            const data = await response.json();
            const mentions = data.mentions || [];
            
            // Group by vendor
            mentions.forEach((mention: any) => {
              const vendorName = mention.vendorName || "Unknown";
              const existing = allVendorData.get(vendorName.toLowerCase());
              
              if (existing) {
                if (mention.type === "positive") existing.positiveCount++;
                else if (mention.type === "warning") existing.warningCount++;
                existing.mentions.push({
                  title: mention.title,
                  type: mention.type,
                  quote: mention.quote || mention.explanation || "",
                });
              } else {
                allVendorData.set(vendorName.toLowerCase(), {
                  name: vendorName,
                  category: mention.category || category,
                  positiveCount: mention.type === "positive" ? 1 : 0,
                  warningCount: mention.type === "warning" ? 1 : 0,
                  mentions: [{
                    title: mention.title,
                    type: mention.type,
                    quote: mention.quote || mention.explanation || "",
                  }],
                });
              }
            });
          }
        } catch (err) {
          console.error(`Failed to fetch ${category}:`, err);
        }
      }
      
      setVendorData(Array.from(allVendorData.values()));
      setDataLoaded(true);
    } catch (err) {
      console.error("Failed to load vendor data:", err);
      setError("Failed to load vendor data");
    } finally {
      setIsLoadingData(false);
    }
  }, [dataLoaded, isLoadingData, fetchWithAuth]);

  // Auto-load data when chat opens
  useEffect(() => {
    if (isOpen && !dataLoaded) {
      loadVendorData();
    }
  }, [isOpen, dataLoaded, loadVendorData]);

  // Stream chat response
  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading || !dataLoaded) return;

    const userMessage: Message = { role: "user", content: messageText.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);

    let assistantContent = "";

    const updateAssistant = (chunk: string) => {
      assistantContent += chunk;
      setMessages(prev => {
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
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          vendorData,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed: ${response.status}`);
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

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
      console.error("Chat error:", err);
      setError(err instanceof Error ? err.message : "Failed to send message");
      // Remove the user message if it failed
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg",
          "bg-primary hover:bg-primary/90 text-primary-foreground",
          "flex items-center justify-center p-0",
          className
        )}
      >
        <Sparkles className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <div className={cn(
      "fixed bottom-6 right-6 z-50 w-[400px] max-w-[calc(100vw-48px)] h-[600px] max-h-[calc(100vh-100px)]",
      "bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-primary text-primary-foreground">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          <div>
            <h3 className="font-semibold text-sm">CDG Pulse AI</h3>
            <p className="text-xs opacity-80">
              {dataLoaded ? `${vendorData.length} vendors loaded` : "Loading..."}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(false)}
          className="h-8 w-8 p-0 text-primary-foreground hover:bg-primary-foreground/10"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Loading Progress */}
      {isLoadingData && (
        <div className="px-4 py-3 bg-muted/50 border-b">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">
              Loading vendor data... {loadingProgress}%
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && dataLoaded && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <Sparkles className="h-8 w-8 text-primary mx-auto mb-2" />
              <h4 className="font-semibold text-foreground">Ask me about vendors</h4>
              <p className="text-sm text-muted-foreground mt-1">
                I can help you compare vendors, find solutions, and make better decisions.
              </p>
            </div>
            
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Try asking:
              </p>
              {SUGGESTED_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(prompt)}
                  className="w-full text-left text-sm px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-foreground"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, i) => (
          <div
            key={i}
            className={cn(
              "flex",
              message.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2.5",
                message.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-muted text-foreground rounded-bl-sm"
              )}
            >
              {message.role === "assistant" ? (
                <div className="prose prose-sm max-w-none dark:prose-invert [&_a]:no-underline">
                  <ChatMarkdown 
                    content={message.content} 
                    knownVendors={vendorData.map(v => v.name)}
                  />
                </div>
              ) : (
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              )}
            </div>
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20">
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        </div>
      )}

      {/* Partial Transcript (when listening) */}
      {voiceState === "listening" && partialTranscript && (
        <div className="px-4 py-2 bg-primary/5 border-t">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mic className="h-3 w-3 text-primary animate-pulse" />
            <span className="italic">{partialTranscript}</span>
          </div>
        </div>
      )}

      {/* Voice State Indicator */}
      {voiceState !== "idle" && voiceState !== "error" && (
        <div className="px-4 py-2 bg-primary/10 border-t">
          <div className="flex items-center gap-2 text-sm">
            {voiceState === "connecting" && (
              <>
                <Loader2 className="h-3 w-3 animate-spin text-primary" />
                <span>Connecting...</span>
              </>
            )}
            {voiceState === "listening" && (
              <>
                <Mic className="h-3 w-3 text-primary animate-pulse" />
                <span>Listening... speak now</span>
              </>
            )}
            {voiceState === "processing" && (
              <>
                <Loader2 className="h-3 w-3 animate-spin text-primary" />
                <span>Processing...</span>
              </>
            )}
            {voiceState === "speaking" && (
              <>
                <Volume2 className="h-3 w-3 text-primary animate-pulse" />
                <span>Speaking...</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t bg-background">
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={dataLoaded ? "Ask about vendors..." : "Loading vendor data..."}
            disabled={isLoading || !dataLoaded || voiceState !== "idle"}
            className="min-h-[44px] max-h-32 resize-none text-sm"
            rows={1}
          />
          
          {/* Voice Button */}
          <Button
            type="button"
            variant={voiceState === "idle" ? "outline" : "default"}
            size="sm"
            onClick={voiceState === "idle" ? startVoice : stopVoice}
            disabled={!dataLoaded || isLoading}
            className={cn(
              "h-11 w-11 p-0 shrink-0 transition-all",
              voiceState === "listening" && "bg-red-500 hover:bg-red-600 border-red-500",
              voiceState === "speaking" && "bg-primary animate-pulse"
            )}
          >
            {voiceState === "idle" ? (
              <Mic className="h-4 w-4" />
            ) : voiceState === "connecting" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : voiceState === "listening" ? (
              <MicOff className="h-4 w-4" />
            ) : voiceState === "speaking" ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>

          {/* Send Button */}
          <Button
            type="submit"
            size="sm"
            disabled={!input.trim() || isLoading || !dataLoaded || voiceState !== "idle"}
            className="h-11 w-11 p-0 shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
};

export default VendorAIChat;
