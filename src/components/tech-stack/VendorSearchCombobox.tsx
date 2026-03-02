import { useState, useRef, useEffect } from "react";
import { Search, X, Plus } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useVendorSearch } from "@/hooks/useVendorSearch";
import { AddVendorInline } from "./AddVendorInline";

interface VendorSearchComboboxProps {
  excludeNames?: string[];
  includeNames?: string[];
  onSelect: (vendorName: string) => void;
  placeholder?: string;
  className?: string;
  compact?: boolean;
}

export function VendorSearchCombobox({
  excludeNames,
  includeNames,
  onSelect,
  placeholder = "Search vendors...",
  className,
  compact = false,
}: VendorSearchComboboxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { search, setSearch, filtered } = useVendorSearch(excludeNames, includeNames);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (name: string) => {
    setShowDropdown(false);
    setSearch("");
    inputRef.current?.blur();
    onSelect(name);
  };

  const handleAddVendor = (name: string) => {
    setShowAddForm(false);
    setSearch("");
    setShowDropdown(false);
    onSelect(name);
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <div
        className={cn(
          "flex items-center w-full gap-2 transition-all duration-300",
          compact
            ? "bg-white/50 px-2.5 py-1.5 rounded-lg border border-slate-200 focus-within:border-yellow-400 focus-within:bg-white focus-within:shadow-sm"
            : "rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm focus-within:border-yellow-400 focus-within:ring-4 focus-within:ring-yellow-50"
        )}
      >
        <Search
          className={cn(
            "shrink-0",
            compact
              ? "h-3.5 w-3.5 text-slate-400"
              : "h-4 w-4 text-slate-400"
          )}
        />
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setShowDropdown(e.target.value.trim().length >= 2);
          }}
          onFocus={() => {
            if (search.trim().length >= 2) setShowDropdown(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setShowDropdown(false);
              inputRef.current?.blur();
            }
          }}
          className={cn(
            "flex-1 bg-transparent outline-none placeholder:text-slate-400",
            compact ? "text-xs" : "text-sm"
          )}
        />
        {search && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setShowDropdown(false);
              inputRef.current?.focus();
            }}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className={cn(compact ? "h-3 w-3" : "h-4 w-4")} />
          </button>
        )}
      </div>

      {showDropdown && (
        <div
          className={cn(
            "absolute z-50 w-full bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden",
            compact ? "mt-1.5 min-w-[240px]" : "mt-1"
          )}
          style={{ maxHeight: "240px", overflowY: "auto" }}
        >
          <div className="p-1">
            {filtered.length > 0 ? (
              filtered.map((vendor) => (
                <button
                  key={vendor.name}
                  type="button"
                  onClick={() => handleSelect(vendor.name)}
                  className={cn(
                    "flex items-center gap-2 w-full rounded-md hover:bg-slate-50 text-left transition-colors",
                    compact ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm"
                  )}
                >
                  <span
                    className={cn(
                      "rounded flex items-center justify-center font-semibold shrink-0",
                      compact
                        ? "h-5 w-5 text-[10px] bg-slate-100 text-slate-500"
                        : "h-6 w-6 text-xs bg-slate-100 text-slate-600"
                    )}
                  >
                    {vendor.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="truncate text-slate-700">
                    {vendor.name}
                  </span>
                  <span
                    className={cn(
                      "ml-auto text-slate-400",
                      compact ? "text-[10px]" : "text-xs"
                    )}
                  >
                    {vendor.count}
                  </span>
                </button>
              ))
            ) : (
              <p
                className={cn(
                  "text-slate-500",
                  compact ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm"
                )}
              >
                No vendors found
              </p>
            )}
          </div>

          <div className="border-t border-slate-100 p-1">
            <button
              type="button"
              onClick={() => { setShowAddForm(true); setShowDropdown(false); }}
              className={cn(
                "flex items-center gap-1.5 w-full rounded-md hover:bg-slate-50 text-slate-500 hover:text-slate-700 transition-colors",
                compact ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm"
              )}
            >
              <Plus className={cn(compact ? "h-3 w-3" : "h-4 w-4")} />
              Can't find it? Add vendor
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showAddForm && (
          <AddVendorInline
            onSubmit={handleAddVendor}
            onCancel={() => setShowAddForm(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
