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
    onSearchChange?.("")
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
        onSearchChange?.("")
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
