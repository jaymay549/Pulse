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
      y: -6,
      transition: { duration: 0.08, delay: i * 0.02 },
    }),
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        type: "spring" as const,
        stiffness: 500,
        damping: 30,
        delay: i * 0.025,
      },
    }),
    exit: (i: number) => ({
      opacity: 0,
      y: -4,
      transition: { duration: 0.06, delay: i * 0.01 },
    }),
  }

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <motion.div
        className={cn(
          "flex items-center w-full rounded-2xl relative overflow-hidden transition-all duration-300",
          isFocused
            ? "bg-white shadow-[0_0_0_1px_hsl(45,80%,55%),0_4px_24px_-4px_hsl(40,30%,20%,0.12),0_8px_40px_-8px_hsl(40,30%,20%,0.08)]"
            : "bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04),0_4px_16px_-2px_rgba(0,0,0,0.04)]"
        )}
        animate={{ scale: isFocused ? 1.005 : 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 35 }}
      >
        {/* Search Icon */}
        <div className="pl-5 py-4">
          <Search className={cn(
            "h-[18px] w-[18px] transition-colors duration-200",
            isFocused ? "text-amber-500" : "text-foreground/25"
          )} />
        </div>

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
            "w-full py-4 pl-3 pr-3 bg-transparent outline-none text-[15px] tracking-[-0.01em]",
            "text-foreground placeholder:text-foreground/30 font-normal"
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
                className="p-1 text-foreground/25 hover:text-foreground/60 transition-colors"
              >
                <X className="h-4 w-4" />
              </motion.button>
            )}
          </AnimatePresence>

          {isPro && (
            <motion.div
              className="text-amber-400"
              animate={{
                opacity: searchQuery.trim().length > 0 ? 1 : 0.35,
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
            initial={{ opacity: 0, y: 6, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.99 }}
            transition={{ type: "spring", stiffness: 500, damping: 35 }}
            className="absolute z-50 w-full mt-2 overflow-hidden bg-white rounded-xl shadow-[0_8px_40px_-8px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.04)]"
            style={{ maxHeight: "320px", overflowY: "auto" }}
          >
            <div className="p-1.5">
              {filteredSuggestions.map((suggestion, index) => (
                <motion.button
                  key={suggestion.name}
                  custom={index}
                  variants={suggestionVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  onClick={() => handleSuggestionClick(suggestion.name)}
                  className="flex items-center gap-3 w-full px-3 py-2.5 cursor-pointer rounded-lg hover:bg-amber-50/60 group transition-colors text-left"
                >
                  <Avatar className="h-7 w-7 border border-black/[0.06] shrink-0">
                    <AvatarImage
                      src={suggestion.logoUrl || undefined}
                      alt={suggestion.name}
                    />
                    <AvatarFallback className="bg-amber-50 text-amber-700 text-[10px] font-bold">
                      {suggestion.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium text-sm text-foreground/80 group-hover:text-foreground transition-colors truncate">
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
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="absolute z-50 w-full mt-2 p-4 bg-white rounded-xl shadow-[0_8px_40px_-8px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.04)] text-center"
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
