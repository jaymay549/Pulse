# Main Page Redesign — AI-Powered Smart Search Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the VendorsV2 main page to center around a smart search bar that doubles as both vendor autocomplete and an inline AI chat advisor (pro users only), replacing the sidebar layout with a search-first experience.

**Architecture:** Create four new components (SmartSearchBar, InlineAIChat, UpgradePromptCard, CategoryPills) and restructure VendorsV2.tsx from a sidebar+main layout to a single-column centered hero layout. The AI chat reuses the existing `vendor-ai-chat` edge function and SSE streaming protocol. The old `VendorAIChat` FAB and `VendorSearchBar` are deleted.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Framer Motion, Supabase Edge Functions (SSE streaming), Clerk auth (`useClerkAuth`), `react-markdown` via existing `ChatMarkdown` component.

---

## Context for the Implementer

**Auth pattern:** `useClerkAuth()` returns `{ user, isAuthenticated, tier, isAdmin, getToken }`. Pro detection: `isProUser(tier)` from `@/utils/tierUtils`.

**AI chat endpoint:** `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vendor-ai-chat` — POST with `{ messages: Message[] }`, auth header `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`. Response is SSE: lines starting with `data: ` containing JSON with `choices[0].delta.content`. Stream ends with `data: [DONE]`.

**Category data:** `categories` is a static array exported from `@/hooks/useVendorFilters` — each item has `{ id: string, label: string, icon: string (emoji) }`. Category counts come from `categoryCounts: Record<string, number>` returned by the `useVendorFilters` hook.

**Vendor suggestions:** `vendorSuggestionsWithLogos` in VendorsV2 is an array of `{ name: string, logoUrl: string | null }` built from `allVendorsList` (fetched on mount via `fetchVendorsList()`).

**Upgrade flow:** No `/upgrade` route exists. Use `UpgradeModal` (already in VendorsV2) or open Stripe portal URL directly. The existing `setShowUpgradeModal(true)` pattern works.

**Key files to read before starting:**
- `src/pages/VendorsV2.tsx` — the page being redesigned (1337 lines)
- `src/components/ui/vendor-search-bar.tsx` — current search bar (being replaced)
- `src/components/vendors/VendorAIChat.tsx` — current AI chat (being replaced)
- `src/components/vendors/ChatMarkdown.tsx` — markdown renderer (kept, reused)
- `src/hooks/useVendorFilters.ts` — categories array + filter hook
- `src/utils/tierUtils.ts` — `isProUser()` function
- `docs/plans/2026-02-23-main-page-redesign-design.md` — the approved design

---

### Task 1: Create CategoryPills Component

**Files:**
- Create: `src/components/vendors/CategoryPills.tsx`

**Why first:** This is a self-contained, simple component with no dependencies on other new components. Getting it done first lets us wire it into the layout early.

**Step 1: Create the component**

Create `src/components/vendors/CategoryPills.tsx`:

```tsx
import { useRef } from "react";
import { cn } from "@/lib/utils";
import type { Category } from "@/hooks/useVendorFilters";

interface CategoryPillsProps {
  categories: Category[];
  selectedCategory: string;
  categoryCounts: Record<string, number>;
  onCategorySelect: (categoryId: string) => void;
  className?: string;
}

export function CategoryPills({
  categories,
  selectedCategory,
  categoryCounts,
  onCategorySelect,
  className,
}: CategoryPillsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className={cn("relative", className)}>
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide"
      >
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          const count = categoryCounts[cat.id] ?? 0;

          return (
            <button
              key={cat.id}
              onClick={() => onCategorySelect(cat.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors border shrink-0",
                isSelected
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-white text-foreground/70 border-border hover:border-primary/40 hover:text-foreground"
              )}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
              {cat.id !== "all" && count > 0 && (
                <span
                  className={cn(
                    "text-xs",
                    isSelected ? "text-primary-foreground/70" : "text-muted-foreground"
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 2: Export from vendors barrel file**

Read `src/components/vendors/index.ts` (or `index.tsx`) and add the export:

```ts
export { CategoryPills } from "./CategoryPills";
```

**Step 3: Verify build**

Run: `npx vite build 2>&1 | tail -5`
Expected: Build succeeds (component isn't used yet, but should compile).

**Step 4: Commit**

```bash
git add src/components/vendors/CategoryPills.tsx src/components/vendors/index.ts
git commit -m "feat: add CategoryPills component for horizontal category navigation"
```

---

### Task 2: Create SmartSearchBar Component

**Files:**
- Create: `src/components/ui/smart-search-bar.tsx`

**This replaces `vendor-search-bar.tsx`.** Same autocomplete behavior but adds: Sparkles icon for pro users, Enter sends to AI callback instead of selecting first match, click on suggestion still navigates to vendor.

**Step 1: Create the component**

Create `src/components/ui/smart-search-bar.tsx`:

```tsx
"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Search, X, Sparkles } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface VendorSuggestion {
  name: string
  logoUrl?: string | null
}

interface SmartSearchBarProps {
  placeholder?: string
  suggestions: VendorSuggestion[]
  onVendorSelect: (vendorName: string) => void
  onAISubmit: (query: string) => void
  onSearchChange?: (query: string) => void
  isPro: boolean
  isLoading?: boolean
  className?: string
}

export function SmartSearchBar({
  placeholder = "Search vendors or ask a question...",
  suggestions,
  onVendorSelect,
  onAISubmit,
  onSearchChange,
  isPro,
  isLoading = false,
  className,
}: SmartSearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isFocused, setIsFocused] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [showDropdown, setShowDropdown] = useState(false)

  // Filter suggestions based on search query
  const filteredSuggestions =
    searchQuery.trim().length >= 2
      ? suggestions
          .filter((item) =>
            item.name.toLowerCase().includes(searchQuery.toLowerCase())
          )
          .slice(0, 8)
      : []

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchQuery(value)
    setShowDropdown(value.trim().length >= 2)
    onSearchChange?.(value)
  }

  const handleClear = () => {
    setSearchQuery("")
    setShowDropdown(false)
    inputRef.current?.focus()
  }

  const handleSuggestionClick = (vendorName: string) => {
    setSearchQuery("")
    setShowDropdown(false)
    onVendorSelect(vendorName)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      if (searchQuery.trim().length > 0) {
        setShowDropdown(false)
        onAISubmit(searchQuery.trim())
        setSearchQuery("")
      }
    } else if (e.key === "Escape") {
      setShowDropdown(false)
      inputRef.current?.blur()
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Allow parent to clear the input (e.g., after chat is cleared)
  const clearInput = () => {
    setSearchQuery("")
    setShowDropdown(false)
  }

  const suggestionVariants = {
    hidden: (i: number) => ({
      opacity: 0,
      y: -8,
      scale: 0.96,
      transition: { duration: 0.1, delay: i * 0.02 },
    }),
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: "spring" as const,
        stiffness: 400,
        damping: 25,
        delay: i * 0.03,
      },
    }),
    exit: (i: number) => ({
      opacity: 0,
      y: -4,
      scale: 0.96,
      transition: { duration: 0.08, delay: i * 0.01 },
    }),
  }

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <motion.div
        className={cn(
          "flex items-center w-full rounded-xl border-2 relative overflow-hidden transition-all duration-200",
          isFocused
            ? "border-primary/50 shadow-lg shadow-primary/10 bg-white"
            : "border-border bg-white/80"
        )}
        animate={{ scale: isFocused ? 1.01 : 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      >
        {/* Search Icon */}
        <motion.div
          className="pl-5 py-4"
          animate={{
            scale: isFocused ? 1.1 : 1,
            color: isFocused ? "var(--primary)" : "var(--muted-foreground)",
          }}
          transition={{ duration: 0.2 }}
        >
          <Search className="h-5 w-5" />
        </motion.div>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={searchQuery}
          onChange={handleInputChange}
          onFocus={() => {
            setIsFocused(true)
            if (searchQuery.trim().length >= 2) {
              setShowDropdown(true)
            }
          }}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          className={cn(
            "w-full py-4 pl-3 pr-3 bg-transparent outline-none placeholder:text-muted-foreground text-base",
            "text-foreground font-normal"
          )}
        />

        {/* Right side: Clear button or Sparkles indicator */}
        <div className="flex items-center pr-4 gap-2">
          <AnimatePresence>
            {searchQuery && (
              <motion.button
                type="button"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleClear}
                className="p-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </motion.button>
            )}
          </AnimatePresence>

          {isPro && (
            <motion.div
              className="text-primary/60"
              animate={{
                opacity: searchQuery.trim().length > 0 ? 1 : 0.4,
              }}
              title="Press Enter to ask AI"
            >
              <Sparkles className="h-4 w-4" />
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Suggestions Dropdown */}
      <AnimatePresence>
        {showDropdown && filteredSuggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="absolute z-50 w-full mt-2 overflow-hidden bg-white rounded-xl shadow-xl border border-border"
            style={{ maxHeight: "320px", overflowY: "auto" }}
          >
            <div className="p-2">
              {filteredSuggestions.map((suggestion, index) => (
                <motion.button
                  key={suggestion.name}
                  custom={index}
                  variants={suggestionVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  onClick={() => handleSuggestionClick(suggestion.name)}
                  className="flex items-center gap-3 w-full px-3 py-2.5 cursor-pointer rounded-lg hover:bg-primary/5 group transition-colors text-left"
                >
                  <Avatar className="h-8 w-8 border border-border/50 shrink-0">
                    <AvatarImage
                      src={suggestion.logoUrl || undefined}
                      alt={suggestion.name}
                    />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                      {suggestion.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium text-foreground group-hover:text-primary transition-colors truncate">
                    {suggestion.name}
                  </span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* No results message */}
      <AnimatePresence>
        {showDropdown &&
          searchQuery.trim().length >= 2 &&
          filteredSuggestions.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute z-50 w-full mt-2 p-4 bg-white rounded-xl shadow-xl border border-border text-center"
            >
              <p className="text-sm text-muted-foreground">
                No vendors found for "{searchQuery}"
                {isPro && " — press Enter to ask AI"}
              </p>
            </motion.div>
          )}
      </AnimatePresence>
    </div>
  )
}
```

**Step 2: Verify build**

Run: `npx vite build 2>&1 | tail -5`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/components/ui/smart-search-bar.tsx
git commit -m "feat: add SmartSearchBar with vendor autocomplete + AI submit on Enter"
```

---

### Task 3: Create InlineAIChat Component

**Files:**
- Create: `src/components/vendors/InlineAIChat.tsx`

**This is the multi-turn AI conversation area that expands below the search bar.** It reuses the SSE streaming logic from `VendorAIChat.tsx` and the `ChatMarkdown` component.

**Step 1: Read the existing VendorAIChat.tsx**

Read `src/components/vendors/VendorAIChat.tsx` to understand the streaming protocol. Key details:
- Endpoint: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vendor-ai-chat`
- Auth: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
- Body: `{ messages: Message[] }` where `Message = { role: "user" | "assistant", content: string }`
- SSE: Read lines, skip empty/comment lines, parse `data: ` prefix, JSON parse for `choices[0].delta.content`
- `data: [DONE]` means stream is complete

**Step 2: Create the component**

Create `src/components/vendors/InlineAIChat.tsx`:

```tsx
import React, { useState, useRef, useEffect } from "react";
import { X, Loader2, Sparkles, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  /** Called when the user dismisses the chat. */
  onClose: () => void;
  className?: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vendor-ai-chat`;

export function InlineAIChat({ initialQuery, onClose, className }: InlineAIChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const processedInitialRef = useRef<string | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // When initialQuery changes and is new, send it
  useEffect(() => {
    if (initialQuery && initialQuery !== processedInitialRef.current) {
      processedInitialRef.current = initialQuery;
      sendMessage(initialQuery);
    }
  }, [initialQuery]);

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: messageText.trim() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setIsLoading(true);
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
      // Remove the user message that failed
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  // Expose sendMessage for follow-up queries from parent
  // Parent calls this by passing a new initialQuery value
  // (the useEffect above handles it)

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={cn(
          "bg-white border border-border rounded-xl shadow-lg overflow-hidden",
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b bg-slate-50">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Vendor Advisor
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Messages */}
        <div className="max-h-[400px] overflow-y-auto p-4 space-y-3">
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
                    : "bg-slate-100 text-foreground rounded-bl-sm"
                )}
              >
                {message.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert [&_a]:no-underline">
                    <ChatMarkdown content={message.content} />
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                )}
              </div>
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex justify-start">
              <div className="bg-slate-100 rounded-2xl rounded-bl-sm px-4 py-3">
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
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
```

**Step 3: Export from vendors barrel**

Add to `src/components/vendors/index.ts`:

```ts
export { InlineAIChat } from "./InlineAIChat";
```

**Step 4: Verify build**

Run: `npx vite build 2>&1 | tail -5`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add src/components/vendors/InlineAIChat.tsx src/components/vendors/index.ts
git commit -m "feat: add InlineAIChat component with SSE streaming for inline AI responses"
```

---

### Task 4: Create UpgradePromptCard Component

**Files:**
- Create: `src/components/vendors/UpgradePromptCard.tsx`

**Shown to free-tier users when they press Enter or click a suggested prompt chip.**

**Step 1: Create the component**

Create `src/components/vendors/UpgradePromptCard.tsx`:

```tsx
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface UpgradePromptCardProps {
  onUpgrade: () => void;
  onDismiss: () => void;
  className?: string;
}

export function UpgradePromptCard({ onUpgrade, onDismiss, className }: UpgradePromptCardProps) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={cn(
          "bg-white border border-border rounded-xl shadow-lg overflow-hidden",
          className
        )}
      >
        <div className="p-6 text-center relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="absolute top-2 right-2 h-7 w-7 p-0 text-slate-400 hover:text-slate-600"
          >
            <X className="h-3.5 w-3.5" />
          </Button>

          <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 mb-3">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>

          <h3 className="text-lg font-semibold text-foreground mb-1">
            AI Vendor Advisor is a Pro feature
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Get instant answers about vendors, comparisons, and recommendations.
          </p>

          <Button onClick={onUpgrade} className="font-semibold">
            Upgrade to Pro
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
```

**Step 2: Export from vendors barrel**

Add to `src/components/vendors/index.ts`:

```ts
export { UpgradePromptCard } from "./UpgradePromptCard";
```

**Step 3: Verify build**

Run: `npx vite build 2>&1 | tail -5`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/components/vendors/UpgradePromptCard.tsx src/components/vendors/index.ts
git commit -m "feat: add UpgradePromptCard for free-tier AI upsell"
```

---

### Task 5: Rewrite VendorsV2 Hero and Layout

**Files:**
- Modify: `src/pages/VendorsV2.tsx`

**This is the biggest task. We restructure the page layout: remove sidebar, center the hero, add SmartSearchBar, suggested prompt chips, and wire in the new components.**

**Step 1: Read the current VendorsV2.tsx**

Read `src/pages/VendorsV2.tsx` in full. Note these key sections:
- Lines 10, 35: `VendorSearchBar` and `VendorAIChat` imports
- Lines 22-30: `VendorSidebar` import from vendors barrel
- Lines 38: `useVendorFilters, categories` import
- Lines 67: `showAIChat` feature flag
- Lines 199: `isProUserValue`
- Lines 604-610: `vendorSuggestionsWithLogos` memo
- Lines 820-834: Desktop sidebar
- Lines 838-964: Main content area (hero + search bar + mobile sidebar sheet)
- Lines 1332: `{showAIChat && <VendorAIChat />}`

**Step 2: Update imports**

Replace the `VendorSearchBar` import with `SmartSearchBar`:

```tsx
// REMOVE this line:
import { VendorSearchBar } from "@/components/ui/vendor-search-bar";

// ADD this line:
import { SmartSearchBar } from "@/components/ui/smart-search-bar";
```

Remove `VendorAIChat` import:

```tsx
// REMOVE this line:
import VendorAIChat from "@/components/vendors/VendorAIChat";
```

Add new component imports to the vendors barrel import:

```tsx
import {
  VendorCard,
  VendorCardDetail,
  VendorSidebar,  // keep import for now, remove usage below
  AIInsightBanner,
  FilterBar,
  UpgradeTeaser,
  TrendingVendorChips,
  CategoryPills,
  InlineAIChat,
  UpgradePromptCard,
} from "@/components/vendors";
```

Also add `categories` type import:

```tsx
import { useVendorFilters, categories } from "@/hooks/useVendorFilters";
// categories is already imported — ensure the Category type is also exported from the hook
```

Remove unused icon imports that were only for the sidebar sheet:

```tsx
// Remove LayoutGrid and Menu from lucide imports if they are only used by sidebar
// Keep them if used elsewhere — check carefully
```

**Step 3: Add AI chat state**

Inside the `VendorsV2` component, after the existing UI state declarations (around line 64), add:

```tsx
// AI Chat state
const [aiQuery, setAiQuery] = useState<string | null>(null);
const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
```

Remove the `showAIChat` feature flag line:

```tsx
// REMOVE:
const showAIChat = searchParams.get("ai_chat") === "true";
```

**Step 4: Add AI submit handler**

After the existing `handleVendorSelect` function (around line 594), add:

```tsx
// Handle AI query from smart search bar
const handleAISubmit = (query: string) => {
  if (isProUserValue) {
    setAiQuery(query);
    setShowUpgradePrompt(false);
  } else {
    setShowUpgradePrompt(true);
    setAiQuery(null);
  }
};

// Handle clearing the AI chat
const handleAIChatClose = () => {
  setAiQuery(null);
  setShowUpgradePrompt(false);
};
```

**Step 5: Add suggested prompts constant**

Near the top of the file (outside the component, after imports), add:

```tsx
const SUGGESTED_PROMPTS = [
  "What DMS should I use for a mid-size dealership?",
  "Compare Cox Automotive vs CDK",
  "Which vendors have the most warnings?",
  "Best CRM for customer follow-up?",
];
```

**Step 6: Rewrite the main content area**

Replace the entire `{/* Main Content */}` section (from line 818 `<div className="max-w-7xl...">` through the closing `</div>` before the footer) with the new single-column layout.

The new structure:

```tsx
{/* Main Content — single column */}
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-6">
  {/* Hero — only on default "all" view with no vendor selected */}
  {selectedCategory === "all" && selectedVendor === null && !aiQuery && !showUpgradePrompt && (
    <div className="max-w-2xl mx-auto text-center pt-8 sm:pt-12 pb-6">
      {/* Updated Daily badge */}
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/20 border border-secondary/30 text-xs font-semibold text-yellow-800 mb-4">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-500 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
        </span>
        Updated Daily
      </div>

      <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground mb-6 leading-[1.1] tracking-tight">
        What do you want to know about{" "}
        <span className="text-yellow-600">auto vendors</span>?
      </h1>
    </div>
  )}

  {/* Smart Search Bar — always visible, centered */}
  <div className={cn(
    "mx-auto w-full transition-all",
    selectedCategory === "all" && selectedVendor === null && !aiQuery && !showUpgradePrompt
      ? "max-w-2xl"
      : "max-w-4xl"
  )}>
    {/* Category context header when filtering */}
    {selectedCategory !== "all" && selectedCategoryData && (
      <div className="flex items-center gap-2 mb-4">
        <span className="text-3xl">{selectedCategoryData.icon}</span>
        <span className="text-lg font-bold text-foreground">
          {selectedCategoryData.label}
        </span>
        <span className="text-sm text-muted-foreground">
          ({categoryCounts[selectedCategory] || 0} reviews)
        </span>
      </div>
    )}

    <SmartSearchBar
      placeholder="Search vendors or ask a question..."
      suggestions={vendorSuggestionsWithLogos}
      onVendorSelect={handleVendorSelect}
      onAISubmit={handleAISubmit}
      onSearchChange={setSearchQuery}
      isPro={isProUserValue}
      isLoading={!!aiQuery && !showUpgradePrompt}
      className=""
    />

    {/* Suggested prompt chips — only on landing state */}
    {selectedCategory === "all" && selectedVendor === null && !aiQuery && !showUpgradePrompt && (
      <div className="flex flex-wrap justify-center gap-2 mt-4">
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => handleAISubmit(prompt)}
            className="text-sm px-3 py-1.5 rounded-full border border-border bg-white text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
          >
            {prompt}
          </button>
        ))}
      </div>
    )}

    {/* Stats line — only on landing state */}
    {selectedCategory === "all" && selectedVendor === null && !aiQuery && !showUpgradePrompt && (
      <div className="flex justify-center gap-4 mt-4 text-sm text-muted-foreground">
        <span><strong className="text-foreground">{totalVerifiedCount}+</strong> recommendations</span>
        <span className="text-border">•</span>
        <span><strong className="text-foreground">{totalWarningCountValue}+</strong> warnings</span>
        <span className="text-border">•</span>
        <span><strong className="text-foreground">{categories.length - 1}</strong> categories</span>
      </div>
    )}

    {/* Inline AI Chat — shown when pro user submits a query */}
    {aiQuery && (
      <InlineAIChat
        initialQuery={aiQuery}
        onClose={handleAIChatClose}
        className="mt-4"
      />
    )}

    {/* Upgrade prompt — shown when free user tries AI */}
    {showUpgradePrompt && (
      <UpgradePromptCard
        onUpgrade={() => setShowUpgradeModal(true)}
        onDismiss={() => setShowUpgradePrompt(false)}
        className="mt-4"
      />
    )}
  </div>

  {/* Category Pills */}
  <div className="max-w-4xl mx-auto mt-6">
    <CategoryPills
      categories={sortedCategories}
      selectedCategory={selectedCategory}
      categoryCounts={categoryCounts}
      onCategorySelect={handleCategoryChange}
    />
  </div>

  {/* Rest of content — full width */}
  <div className="mt-6">
    {/* AI Insight Banner */}
    {(selectedVendor !== null || selectedCategory !== "all") && (
      <AIInsightBanner
        data={wamMentions}
        selectedCategory={selectedCategory}
        searchQuery={searchQuery}
        selectedVendor={selectedVendor}
        isProUser={isProUserValue}
        getToken={getToken}
        onUpgradeClick={() => setShowUpgradeModal(true)}
        className="mb-6"
      />
    )}

    {/* Filter Bar — only when vendor selected */}
    {selectedVendor !== null && (
      <div className="mb-6">
        <FilterBar
          typeFilter={typeFilter}
          onTypeFilterChange={handleTypeFilterChange}
          positiveCount={positiveCount}
          warningCount={warningCount}
          totalCount={totalCount}
          canAccessWarnings={accessLevel.unlimitedAccess}
          onWarningsLocked={() => setShowUpgradeModal(true)}
        />
      </div>
    )}

    {/* Trending Vendor Chips */}
    {selectedVendor === null && selectedCategory === "all" && (
      <TrendingVendorChips
        onVendorSelect={handleVendorSelect}
        getLogoUrl={(vendorName) => getVendorLogoUrl(vendorName)}
        className="mt-0 mb-3"
      />
    )}

    {/* Category Vendors Section */}
    {selectedCategory !== "all" && categoryVendors.length > 0 && (
      /* ... keep existing category vendors JSX unchanged ... */
    )}

    {/* Results Grid */}
    {/* ... keep existing results grid JSX unchanged ... */}

    {/* Infinite scroll sentinel */}
    {/* ... keep existing sentinel JSX unchanged ... */}

    {/* Empty State */}
    {/* ... keep existing empty state JSX unchanged ... */}

    {/* Loading State */}
    {/* ... keep existing loading state JSX unchanged ... */}

    {/* Upgrade sections */}
    {/* ... keep existing upgrade sections JSX unchanged ... */}
  </div>
</div>
```

**Step 7: Remove sidebar references**

Delete the desktop `<VendorSidebar>` and mobile `<Sheet>` sidebar code entirely. Remove the `<div className="flex gap-8">` wrapper that created the sidebar+main two-column layout. The `sidebarOpen` / `setSidebarOpen` state and the mobile hamburger `<Menu>` button in the header can be removed too (category pills replace them).

Also remove the `LayoutGrid` and `Menu` imports from lucide-react if no longer used.

**Step 8: Remove old VendorAIChat render**

Remove from near the bottom of the JSX:

```tsx
// REMOVE:
{showAIChat && <VendorAIChat />}
```

**Step 9: Remove VendorSidebar from vendors barrel import**

Update the import to remove `VendorSidebar`:

```tsx
import {
  VendorCard,
  VendorCardDetail,
  AIInsightBanner,
  FilterBar,
  UpgradeTeaser,
  TrendingVendorChips,
  CategoryPills,
  InlineAIChat,
  UpgradePromptCard,
} from "@/components/vendors";
```

**Step 10: Verify build**

Run: `npx vite build 2>&1 | tail -5`
Expected: Build succeeds. Fix any TypeScript errors.

**Step 11: Manual verification**

Run: `npx vite dev`

Check in browser:
1. Landing page shows centered hero with heading + search bar + prompt chips + stats
2. Typing in search bar shows vendor autocomplete dropdown
3. Clicking a vendor suggestion navigates to vendor profile
4. Pressing Enter (as pro user) opens InlineAIChat with streaming response
5. Category pills are visible below the hero
6. Clicking a category pill filters the vendor grid
7. Scrolling down shows trending chips and vendor grid full-width

**Step 12: Commit**

```bash
git add src/pages/VendorsV2.tsx
git commit -m "feat: redesign main page with centered hero, smart search bar, and inline AI chat"
```

---

### Task 6: Handle Follow-Up AI Queries

**Files:**
- Modify: `src/components/vendors/InlineAIChat.tsx`
- Modify: `src/pages/VendorsV2.tsx`

**The current InlineAIChat receives an `initialQuery` but needs to accept follow-up queries from the SmartSearchBar when the chat is open.**

**Step 1: Update VendorsV2 to pass follow-up queries**

In VendorsV2, change the `handleAISubmit` to use a counter-based approach so InlineAIChat can detect new queries even if the text is the same:

```tsx
const [aiQuery, setAiQuery] = useState<{ text: string; id: number } | null>(null);
const aiQueryIdRef = useRef(0);

const handleAISubmit = (query: string) => {
  if (isProUserValue) {
    aiQueryIdRef.current += 1;
    setAiQuery({ text: query, id: aiQueryIdRef.current });
    setShowUpgradePrompt(false);
  } else {
    setShowUpgradePrompt(true);
    setAiQuery(null);
  }
};
```

Update InlineAIChat usage:

```tsx
{aiQuery && (
  <InlineAIChat
    initialQuery={aiQuery.text}
    queryId={aiQuery.id}
    onClose={handleAIChatClose}
    className="mt-4"
  />
)}
```

**Step 2: Update InlineAIChat to accept queryId**

Add `queryId` prop and track it:

```tsx
interface InlineAIChatProps {
  initialQuery: string | null;
  queryId: number;
  onClose: () => void;
  className?: string;
}

export function InlineAIChat({ initialQuery, queryId, onClose, className }: InlineAIChatProps) {
  // ...existing state...
  const lastProcessedQueryIdRef = useRef<number>(0);

  // Send query when queryId changes
  useEffect(() => {
    if (initialQuery && queryId > lastProcessedQueryIdRef.current) {
      lastProcessedQueryIdRef.current = queryId;
      sendMessage(initialQuery);
    }
  }, [queryId, initialQuery]);

  // Remove the old processedInitialRef-based useEffect
```

**Step 3: Verify build and test**

Run: `npx vite build 2>&1 | tail -5`

Manual test: Open chat with a query, then type a follow-up in the search bar and press Enter. The follow-up should appear in the chat.

**Step 4: Commit**

```bash
git add src/pages/VendorsV2.tsx src/components/vendors/InlineAIChat.tsx
git commit -m "feat: support follow-up AI queries through SmartSearchBar"
```

---

### Task 7: Delete Old Components

**Files:**
- Delete: `src/components/vendors/VendorAIChat.tsx`
- Delete: `src/components/ui/vendor-search-bar.tsx`

**Step 1: Verify no remaining imports**

Search for any remaining references:

```bash
grep -r "VendorAIChat" src/ --include="*.tsx" --include="*.ts"
grep -r "vendor-search-bar" src/ --include="*.tsx" --include="*.ts"
grep -r "VendorSearchBar" src/ --include="*.tsx" --include="*.ts"
```

Expected: No results (all references were removed in Task 5).

If there are remaining references, remove them first.

**Step 2: Delete the files**

```bash
rm src/components/vendors/VendorAIChat.tsx
rm src/components/ui/vendor-search-bar.tsx
```

**Step 3: Clean up vendor barrel exports**

Check `src/components/vendors/index.ts` — if it exports `VendorAIChat`, remove that export line.

**Step 4: Verify build**

Run: `npx vite build 2>&1 | tail -5`
Expected: Build succeeds with no errors.

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: delete VendorAIChat and VendorSearchBar (replaced by inline chat + SmartSearchBar)"
```

---

### Task 8: Mobile Responsive Polish

**Files:**
- Modify: `src/pages/VendorsV2.tsx`
- Modify: `src/components/vendors/CategoryPills.tsx`

**Ensure the new layout looks good on mobile.**

**Step 1: Check the header**

The hamburger menu button was removed (it opened the sidebar sheet). Verify the header still works without it. The mobile category navigation is now handled by CategoryPills which is horizontally scrollable. Remove any leftover `sidebarOpen` state and the `Sheet` import if unused.

**Step 2: Ensure CategoryPills scroll gracefully on mobile**

The pills should be horizontally scrollable with touch. Add CSS for smooth scrolling and hide the scrollbar:

In CategoryPills, add to the scroll container:

```tsx
className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory"
```

And on each pill button, add `snap-start`:

```tsx
className={cn("... shrink-0 snap-start", ...)}
```

**Step 3: Check the hero on small screens**

The hero heading should be smaller on mobile. It uses `text-3xl sm:text-4xl lg:text-5xl` which is fine. Prompt chips should wrap on mobile — they use `flex-wrap` so this works.

**Step 4: Check InlineAIChat on mobile**

The chat area uses `max-h-[400px]` which may be too tall on small screens. Add responsive max-height:

```tsx
className="max-h-[60vh] sm:max-h-[400px] overflow-y-auto p-4 space-y-3"
```

**Step 5: Verify build and manual test at mobile sizes**

Run: `npx vite dev`

Test at 375px width (iPhone SE):
1. Hero text wraps cleanly
2. Search bar is full width
3. Prompt chips wrap
4. Category pills scroll horizontally
5. AI chat response area isn't too tall
6. Vendor grid is single column

**Step 6: Commit**

```bash
git add src/pages/VendorsV2.tsx src/components/vendors/CategoryPills.tsx src/components/vendors/InlineAIChat.tsx
git commit -m "fix: mobile responsive polish for new main page layout"
```

---

### Task 9: Final Cleanup and Type Export

**Files:**
- Modify: `src/hooks/useVendorFilters.ts` (ensure `Category` type is exported)
- Modify: `src/components/vendors/index.ts` (ensure all new exports exist)

**Step 1: Ensure Category type is exported**

Read `src/hooks/useVendorFilters.ts` and check if the `Category` interface is exported. If not, add `export` to it. The `CategoryPills` component imports this type.

**Step 2: Ensure barrel exports are clean**

Read `src/components/vendors/index.ts` and verify it includes:

```ts
export { CategoryPills } from "./CategoryPills";
export { InlineAIChat } from "./InlineAIChat";
export { UpgradePromptCard } from "./UpgradePromptCard";
```

And does NOT include:

```ts
// Should be removed:
export { default as VendorAIChat } from "./VendorAIChat";
```

**Step 3: Run final build**

Run: `npx vite build 2>&1 | tail -20`
Expected: Build succeeds with no errors or warnings about missing exports.

**Step 4: Commit**

```bash
git add src/hooks/useVendorFilters.ts src/components/vendors/index.ts
git commit -m "chore: ensure Category type export and clean up barrel file"
```

---

## Summary

| Task | Component | Action |
|---|---|---|
| 1 | CategoryPills | Create horizontal scrollable category pills |
| 2 | SmartSearchBar | Create search bar with autocomplete + Enter-to-AI |
| 3 | InlineAIChat | Create inline SSE streaming AI conversation |
| 4 | UpgradePromptCard | Create free-tier upgrade card |
| 5 | VendorsV2 | Rewrite layout: remove sidebar, center hero, wire new components |
| 6 | Follow-up queries | Support multi-turn via SmartSearchBar → InlineAIChat |
| 7 | Delete old | Remove VendorAIChat + VendorSearchBar |
| 8 | Mobile polish | Responsive fixes for new layout |
| 9 | Type exports | Ensure Category type and barrel exports are clean |
