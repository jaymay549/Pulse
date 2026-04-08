import { useState, useCallback, useMemo, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Trash2,
  Users,
  Database,
  Globe,
  DollarSign,
  Wrench,
  Bot,
  Package,
  MoreHorizontal,
  ChevronDown,
  CheckCircle2,
  History,
  Star,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { VendorSearchCombobox } from "./VendorSearchCombobox";
import {
  REASON_CATEGORIES,
  type StackCategory,
  type ReasonCategory,
} from "@/hooks/useTechStackProfile";

// ── Types ───────────────────────────────────────────────────

export interface CanvasVendor {
  vendor_name: string;
  category: StackCategory;
  is_current: boolean;
  status: "stable" | "exploring" | "left";
  switching_intent: boolean;
  exit_reasons: ReasonCategory[];
  sentiment_score: number | null;
  insight_text: string;
}

interface TechStackCanvasProps {
  vendors: CanvasVendor[];
  onUpdateVendor: (name: string, category: StackCategory, updates: Partial<CanvasVendor>) => void;
  onAddVendor: (name: string, category: StackCategory, isCurrent: boolean) => void;
  onRemoveVendor: (name: string, category: StackCategory) => void;
  skippedCategories: StackCategory[];
  onToggleSkipCategory: (category: StackCategory) => void;
  isSaving?: boolean;
}

// ── Constants ───────────────────────────────────────────────

interface CategoryDef {
  id: StackCategory;
  label: string;
  icon: any;
  color: string;
  bg: string;
  borderColor: string;
}

const STACK_CATEGORIES: CategoryDef[] = [
  { id: "CRM", label: "CRM", icon: Users, color: "text-blue-600", bg: "bg-blue-50/50", borderColor: "border-blue-100" },
  { id: "DMS", label: "DMS", icon: Database, color: "text-slate-700", bg: "bg-slate-100/50", borderColor: "border-slate-200" },
  { id: "Website", label: "Website", icon: Globe, color: "text-blue-500", bg: "bg-blue-50/50", borderColor: "border-blue-100" },
  { id: "Appraisal", label: "Appraisal", icon: DollarSign, color: "text-yellow-600", bg: "bg-yellow-50/50", borderColor: "border-yellow-100" },
  { id: "Fixed Ops", label: "Fixed Ops", icon: Wrench, color: "text-slate-600", bg: "bg-slate-100/50", borderColor: "border-slate-200" },
  { id: "AI", label: "AI", icon: Bot, color: "text-blue-600", bg: "bg-blue-50/50", borderColor: "border-blue-100" },
  { id: "Inventory", label: "Inventory", icon: Package, color: "text-yellow-600", bg: "bg-yellow-50/50", borderColor: "border-yellow-100" },
  { id: "Other", label: "Other", icon: MoreHorizontal, color: "text-slate-500", bg: "bg-slate-100/50", borderColor: "border-slate-200" },
];

// ── Components ──────────────────────────────────────────────

export function TechStackCanvas({
  vendors,
  onUpdateVendor,
  onAddVendor,
  onRemoveVendor,
  skippedCategories,
  onToggleSkipCategory,
}: TechStackCanvasProps) {
  const currentVendors = useMemo(() => vendors.filter(v => v.is_current), [vendors]);
  const formerVendors = useMemo(() => vendors.filter(v => !v.is_current), [vendors]);

  return (
    <div className="space-y-12">
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              Your Current Stack
            </h3>
            <p className="text-sm text-slate-500 mt-1 ml-10">
              Populate the core tools you're running today.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {STACK_CATEGORIES.map((cat) => (
            <CategorySlot
              key={cat.id}
              category={cat}
              vendors={currentVendors.filter(v => v.category === cat.id)}
              onAddVendor={(name) => onAddVendor(name, cat.id, true)}
              onUpdateVendor={onUpdateVendor}
              onRemoveVendor={onRemoveVendor}
              isSkipped={skippedCategories.includes(cat.id)}
              onToggleSkip={() => onToggleSkipCategory(cat.id)}
            />
          ))}
        </div>
      </div>

      <div className="pt-8 border-t border-slate-100">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <History className="h-5 w-5 text-amber-600" />
              </div>
              The Ex-Factor
            </h3>
            <p className="text-sm text-slate-500 mt-1 ml-10">
              Any vendors you've moved on from in the last 2 years?
            </p>
          </div>
        </div>

        <div className="bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 p-6">
          <div className="max-w-md mx-auto mb-8">
            <VendorSearchCombobox
              placeholder="Search for a former vendor..."
              excludeNames={vendors.map(v => v.vendor_name)}
              onSelect={(name) => onAddVendor(name, "Other", false)}
              className="bg-white shadow-sm border-slate-200"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence mode="popLayout">
              {formerVendors.map((v) => (
                <VendorCard
                  key={`${v.vendor_name}-${v.category}`}
                  vendor={v}
                  onUpdate={(updates) => onUpdateVendor(v.vendor_name, v.category, updates)}
                  onRemove={() => onRemoveVendor(v.vendor_name, v.category)}
                  isFormer
                />
              ))}
            </AnimatePresence>
            {formerVendors.length === 0 && (
              <div className="col-span-full py-8 text-center text-slate-400 text-sm italic">
                No former vendors added yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CategorySlot({
  category,
  vendors,
  onAddVendor,
  onUpdateVendor,
  onRemoveVendor,
  isSkipped,
  onToggleSkip,
}: {
  category: CategoryDef;
  vendors: CanvasVendor[];
  onAddVendor: (name: string) => void;
  onUpdateVendor: (name: string, cat: StackCategory, updates: Partial<CanvasVendor>) => void;
  onRemoveVendor: (name: string, cat: StackCategory) => void;
  isSkipped: boolean;
  onToggleSkip: () => void;
}) {
  const [isSearching, setIsSearching] = useState(false);
  const Icon = category.icon;

  return (
    <div className={cn(
      "group relative flex flex-col h-full rounded-2xl border transition-all duration-300 overflow-hidden",
      vendors.length > 0 ? "bg-white border-slate-200 shadow-sm" : 
      isSkipped ? "bg-slate-50 border-slate-200 opacity-60" :
      cn("border-dashed", category.bg, category.borderColor)
    )}>
      <div className="px-4 py-3 flex items-center justify-between border-b border-transparent group-hover:border-slate-100 transition-colors">
        <div className="flex items-center gap-2.5">
          <div className={cn("p-1.5 rounded-lg", isSkipped ? "bg-slate-200" : category.bg)}>
            <Icon className={cn("h-4 w-4", isSkipped ? "text-slate-500" : category.color)} />
          </div>
          <span className={cn("text-sm font-semibold", isSkipped ? "text-slate-500" : "text-slate-700")}>
            {category.label}
            {isSkipped && <span className="ml-2 text-[10px] uppercase tracking-wider font-bold text-slate-400">(N/A)</span>}
          </span>
        </div>
        {(vendors.length > 0 || isSkipped) && (
          <div className="flex items-center gap-1">
            {isSkipped ? (
              <button
                onClick={onToggleSkip}
                className="text-[10px] font-bold text-slate-900 bg-yellow-400 hover:bg-yellow-500 px-2 py-1 rounded shadow-sm transition-all"
              >
                Enable Category
              </button>
            ) : (
              <button
                onClick={() => setIsSearching(true)}
                className="h-7 w-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col gap-3">
        <AnimatePresence mode="popLayout">
          {vendors.map((v) => (
            <VendorCard
              key={`${v.vendor_name}-${v.category}`}
              vendor={v}
              onUpdate={(updates) => onUpdateVendor(v.vendor_name, category.id, updates)}
              onRemove={() => onRemoveVendor(v.vendor_name, category.id)}
            />
          ))}
        </AnimatePresence>

        {vendors.length === 0 && !isSearching && !isSkipped && (
          <div className="flex-1 min-h-[100px] flex flex-col items-center justify-center gap-4">
            <button
              onClick={() => setIsSearching(true)}
              className="flex flex-col items-center gap-2 group/add text-slate-400 hover:text-slate-600 transition-colors"
            >
              <div className="h-10 w-10 rounded-full border-2 border-dashed border-slate-200 flex items-center justify-center group-hover/add:border-slate-300 group-hover/add:scale-110 transition-all">
                <Plus className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium">Add {category.label} Vendor</span>
            </button>
            
            <div className="w-full border-t border-slate-100 mt-2 pt-4 flex justify-center">
              <button
                onClick={onToggleSkip}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-[10px] font-bold text-slate-500 hover:text-slate-900 hover:border-slate-300 hover:shadow-sm transition-all uppercase tracking-widest"
              >
                I don't need/have this
              </button>
            </div>
          </div>
        )}

        {isSkipped && vendors.length === 0 && (
          <div className="flex-1 min-h-[100px] flex items-center justify-center">
            <p className="text-xs text-slate-400 italic">Marked as not applicable</p>
          </div>
        )}

        {isSearching && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-2"
          >
            <VendorSearchCombobox
              compact
              excludeNames={[]}
              onSelect={(name) => {
                onAddVendor(name);
                setIsSearching(false);
              }}
              placeholder={`Search ${category.label}...`}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSearching(false)}
              className="w-full text-[10px] h-6 uppercase tracking-wider text-slate-400 hover:text-slate-600"
            >
              Cancel
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}

const VendorCard = forwardRef<HTMLDivElement, {
  vendor: CanvasVendor;
  onUpdate: (updates: Partial<CanvasVendor>) => void;
  onRemove: () => void;
  isFormer?: boolean;
}>(({
  vendor,
  onUpdate,
  onRemove,
  isFormer = false,
}, ref) => {
  // Auto-expand if missing core data (newly added)
  const isNew = !vendor.sentiment_score && (isFormer || vendor.status === "stable");
  const [isExpanded, setIsExpanded] = useState(isNew);

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "relative rounded-xl border bg-white overflow-hidden transition-all duration-300",
        isExpanded ? "shadow-md border-slate-300 ring-1 ring-slate-200" : "border-slate-200 hover:border-slate-300 shadow-sm"
      )}
    >
      <div className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded bg-slate-100 flex items-center justify-center shrink-0 text-[10px] font-bold text-slate-500">
              {vendor.vendor_name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-slate-900 truncate leading-none mb-1">
                {vendor.vendor_name}
              </h4>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className={cn(
                  "px-1 py-0 text-[9px] uppercase tracking-wider h-4",
                  vendor.status === "stable" ? "text-blue-600 border-blue-100 bg-blue-50/30" :
                  vendor.status === "exploring" ? "text-yellow-700 border-yellow-200 bg-yellow-50/50" :
                  "text-slate-500 border-slate-200 bg-slate-50"
                )}>
                  {vendor.status === "stable" ? "Stable" : vendor.status === "exploring" ? "Exploring" : "Left"}
                </Badge>
                {vendor.sentiment_score ? (
                  <div className="flex items-center gap-0.5 text-yellow-500">
                    <Star className="h-3 w-3 fill-current" />
                    <span className="text-[10px] font-bold">{vendor.sentiment_score}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-red-500 animate-pulse">
                    <AlertCircle className="h-3 w-3" />
                    <span className="text-[9px] font-bold uppercase tracking-tight">Needs Rating</span>
                  </div>
                )}
                {((vendor.status === "exploring" || vendor.status === "left") && vendor.exit_reasons.length === 0) && (
                  <div className="flex items-center gap-1 text-red-500 animate-pulse ml-2">
                    <AlertCircle className="h-3 w-3" />
                    <span className="text-[9px] font-bold uppercase tracking-tight">Reasons Required</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={cn(
                "h-7 w-7 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-50 transition-all",
                isExpanded && "rotate-180 text-slate-900 bg-slate-100"
              )}
            >
              <ChevronDown className="h-4 w-4" />
            </button>
            <button
              onClick={onRemove}
              className="h-7 w-7 rounded-full flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-slate-100 bg-slate-50/30 overflow-hidden"
          >
            <div className="p-4 space-y-5">
              {/* Status Selector (Only for current vendors) */}
              {!isFormer && (
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold flex items-center gap-1">
                    Relationship Status
                    <span className="text-red-500">*</span>
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => onUpdate({ status: "stable", switching_intent: false })}
                      className={cn(
                        "flex flex-col items-center justify-center p-2 rounded-lg border text-[11px] font-semibold transition-all",
                        vendor.status === "stable"
                          ? "bg-white border-blue-500 text-blue-700 shadow-sm"
                          : "bg-white/50 border-slate-200 text-slate-500 hover:border-slate-300"
                      )}
                    >
                      Married to it
                    </button>
                    <button
                      onClick={() => onUpdate({ status: "exploring", switching_intent: true })}
                      className={cn(
                        "flex flex-col items-center justify-center p-2 rounded-lg border text-[11px] font-semibold transition-all",
                        vendor.status === "exploring"
                          ? "bg-white border-yellow-500 text-yellow-700 shadow-sm"
                          : "bg-white/50 border-slate-200 text-slate-500 hover:border-slate-300"
                      )}
                    >
                      Exploring Options
                    </button>
                  </div>
                </div>
              )}

              {(vendor.status === "exploring" || isFormer) && (
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                    {isFormer ? "Why did you leave?" : "Why are you looking?"}
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {REASON_CATEGORIES.map((cat) => (
                      <button
                        key={cat.value}
                        onClick={() => {
                          const reasons = vendor.exit_reasons.includes(cat.value)
                            ? vendor.exit_reasons.filter(r => r !== cat.value)
                            : [...vendor.exit_reasons, cat.value];
                          onUpdate({ exit_reasons: reasons });
                        }}
                        className={cn(
                          "px-2 py-1 rounded-full text-[10px] font-medium border transition-all",
                          vendor.exit_reasons.includes(cat.value)
                            ? "bg-slate-900 border-slate-900 text-white"
                            : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                        )}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                    Overall Satisfaction
                  </Label>
                  <span className={cn(
                    "text-xs font-bold px-1.5 py-0.5 rounded",
                    (vendor.sentiment_score || 0) >= 7 ? "bg-blue-100 text-blue-700" :
                    (vendor.sentiment_score || 0) >= 4 ? "bg-yellow-100 text-yellow-700" :
                    "bg-red-100 text-red-700"
                  )}>
                    {vendor.sentiment_score || "-"} / 10
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={vendor.sentiment_score || 0}
                  onChange={(e) => onUpdate({ sentiment_score: parseInt(e.target.value) })}
                  className={cn(
                    "w-full h-1.5 rounded-lg appearance-none cursor-pointer transition-all focus:outline-none",
                    !vendor.sentiment_score && "ring-1 ring-blue-400/30"
                  )}
                  style={{
                    background: vendor.sentiment_score
                      ? `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${((vendor.sentiment_score - 1) / 9) * 100}%, #e2e8f0 ${((vendor.sentiment_score - 1) / 9) * 100}%, #e2e8f0 100%)`
                      : "#f1f5f9",
                  }}
                />
                <div className="flex justify-between px-0.5">
                  <span className="text-[8px] text-slate-400 font-bold uppercase">Poor</span>
                  <span className="text-[8px] text-slate-400 font-bold uppercase">Excellent</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                  Specific Insights (Optional)
                </Label>
                <Textarea
                  placeholder="What's the one thing people should know?"
                  value={vendor.insight_text}
                  onChange={(e) => onUpdate({ insight_text: e.target.value })}
                  className="text-xs min-h-[60px] resize-none bg-white"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

VendorCard.displayName = "VendorCard";
