import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  Loader2,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  Cloud,
  RefreshCw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useTechStackEntries,
  useSaveTechStackStep,
  useRemoveTechStackEntry,
  useToggleSkipCategory,
  type StackCategory,
  type TechStackEntry,
} from "@/hooks/useTechStackProfile";
import { computeTechStackCompletion } from "@/hooks/useTechStackCompletion";
import { TechStackCanvas, type CanvasVendor } from "./TechStackCanvas";

// ── Types ───────────────────────────────────────────────────

interface TechStackWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ── Wizard ──────────────────────────────────────────────────

export function TechStackWizard({ open, onOpenChange }: TechStackWizardProps) {
  const navigate = useNavigate();
  const [vendors, setVendors] = useState<CanvasVendor[]>([]);
  const [skippedCategories, setSkippedCategories] = useState<StackCategory[]>([]);
  
  const { data: techData, isLoading: isLoadingEntries } = useTechStackEntries();
  const saveMutation = useSaveTechStackStep();
  const removeMutation = useRemoveTechStackEntry();
  const toggleSkipMutation = useToggleSkipCategory();
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitializedRef = useRef(false);

  // Initialize from DB only once when opening
  useEffect(() => {
    if (open) {
      if (techData && !hasInitializedRef.current) {
        setVendors(techData.entries.map(entryToCanvasVendor));
        setSkippedCategories(techData.skippedCategories);
        hasInitializedRef.current = true;
      }
    } else {
      hasInitializedRef.current = false;
    }
  }, [open, techData]);

  const triggerAutoSave = useCallback((updatedVendors: CanvasVendor[]) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    
    saveTimeoutRef.current = setTimeout(() => {
      saveMutation.mutate({
        vendors: updatedVendors.map((v) => ({
          vendor_name: v.vendor_name,
          category: v.category,
          is_current: v.is_current,
          status: v.status,
          switching_intent: v.switching_intent,
          sentiment_score: v.sentiment_score,
          insight_text: v.insight_text || null,
          exit_reasons: v.exit_reasons,
        })),
        silent: true
      });
    }, 1000);
  }, [saveMutation]);

  const handleUpdateVendor = useCallback((name: string, category: StackCategory, updates: Partial<CanvasVendor>) => {
    setVendors(prev => {
      const next = prev.map(v => 
        v.vendor_name === name && v.category === category ? { ...v, ...updates } : v
      );
      triggerAutoSave(next);
      return next;
    });
  }, [triggerAutoSave]);

  const handleToggleSkipCategory = useCallback((category: StackCategory) => {
    setSkippedCategories(prev => {
      const isCurrentlySkipped = prev.includes(category);
      const next = isCurrentlySkipped 
        ? prev.filter(c => c !== category) 
        : [...prev, category];
      
      toggleSkipMutation.mutate({ category, isSkipped: !isCurrentlySkipped });
      return next;
    });
  }, [toggleSkipMutation]);

  const handleAddVendor = useCallback((name: string, category: StackCategory, isCurrent: boolean) => {
    // Check for duplicate before updating state
    const alreadyExists = vendors.some(v => v.vendor_name === name && v.category === category);
    if (alreadyExists) return;

    // If it was skipped, unskip it
    if (skippedCategories.includes(category)) {
      setSkippedCategories(prev => prev.filter(c => c !== category));
      toggleSkipMutation.mutate({ category, isSkipped: false });
    }

    const newVendor: CanvasVendor = {
      vendor_name: name,
      category,
      is_current: isCurrent,
      status: isCurrent ? "stable" : "left",
      switching_intent: false,
      exit_reasons: [],
      sentiment_score: null,
      insight_text: "",
    };

    setVendors(prev => [...prev, newVendor]);
    saveMutation.mutate({
      vendors: [newVendor],
      silent: true
    });
  }, [vendors, skippedCategories, saveMutation, toggleSkipMutation]);

  const handleRemoveVendor = useCallback((name: string, category: StackCategory) => {
    setVendors(prev => {
      const next = prev.filter(v => !(v.vendor_name === name && v.category === category));
      removeMutation.mutate({ vendor_name: name, category });
      return next;
    });
  }, [removeMutation]);

  const handleComplete = async () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    
    await saveMutation.mutateAsync({
      vendors: vendors.map((v) => ({
        vendor_name: v.vendor_name,
        category: v.category,
        is_current: v.is_current,
        status: v.status,
        switching_intent: v.switching_intent,
        sentiment_score: v.sentiment_score,
        insight_text: v.insight_text || null,
        exit_reasons: v.exit_reasons,
      })),
    });
    onOpenChange(false);
    navigate("/dealers-like-me");
  };

  const completionStats = useMemo(() => {
    // Map CanvasVendor to TechStackEntry format for the computation hook
    const pseudoEntries: TechStackEntry[] = vendors.map(v => ({
      vendor_name: v.vendor_name,
      category: v.category,
      sentiment_score: v.sentiment_score,
      status: v.status,
      is_current: v.is_current,
      exit_reasons: v.exit_reasons.map(r => ({ reason_category: r } as any)),
    } as any));

    return computeTechStackCompletion(pseudoEntries, skippedCategories);
  }, [vendors, skippedCategories]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-5xl p-0 gap-0 overflow-hidden max-h-[100dvh] sm:max-h-[92vh] flex flex-col bg-white [&>button.absolute]:text-white [&>button.absolute]:hover:text-yellow-300 [&>button.absolute]:z-10"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">Tech Stack Intelligence Builder</DialogTitle>
        <DialogDescription className="sr-only">
          Configure your current and former technology stack to unlock market intelligence reports.
        </DialogDescription>
        {/* Header — stacks on mobile */}
        <div className="bg-slate-900 px-4 py-4 sm:px-8 sm:py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-gradient-to-br from-yellow-300 to-yellow-500 flex items-center justify-center shadow-lg shadow-yellow-500/20 shrink-0">
              <LayoutDashboard className="h-5 w-5 sm:h-6 sm:w-6 text-slate-900" />
            </div>
            <div className="min-w-0">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <h2 className="text-base sm:text-xl font-bold text-white tracking-tight shrink-0">
                    Tech Stack Intelligence
                  </h2>
                  <AnimatePresence mode="wait">
                    {saveMutation.isPending ? (
                      <motion.div
                        key="saving"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="flex items-center gap-1.5 text-slate-400 text-[10px] uppercase tracking-widest font-bold whitespace-nowrap"
                      >
                        <RefreshCw className="h-3 w-3 animate-spin" />
                        <span className="hidden sm:inline">Saving...</span>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="saved"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-1.5 text-emerald-400 text-[10px] uppercase tracking-widest font-bold whitespace-nowrap"
                      >
                        <Cloud className="h-3 w-3" />
                        <span className="hidden sm:inline">All Changes Saved</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              <div className="hidden sm:flex items-center gap-3 mt-1">
                <p className="text-sm text-slate-400">
                  Build your profile to unlock dealer insights
                </p>
                <div className="h-1 w-1 rounded-full bg-slate-600" />
                <div className="flex items-center gap-1.5 text-yellow-400 text-xs font-semibold">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Verified Data
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center sm:flex-col sm:items-end gap-2 pr-6">
            <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Profile Strength</span>
            <div className="flex-1 sm:flex-none w-full sm:w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${completionStats.percentage}%` }}
                className="h-full bg-yellow-400 shadow-[0_0_8px_rgba(253,216,53,0.5)]"
              />
            </div>
            <span className="text-sm font-bold text-white">{completionStats.percentage}%</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50/30">
          {isLoadingEntries ? (
            <div className="h-full flex flex-col items-center justify-center gap-4 py-20">
              <Loader2 className="h-8 w-8 text-yellow-500 animate-spin" />
              <p className="text-slate-400 text-sm animate-pulse">Scanning your stack...</p>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto px-4 py-6 sm:px-8 sm:py-10">
              <TechStackCanvas
                vendors={vendors}
                onUpdateVendor={handleUpdateVendor}
                onAddVendor={handleAddVendor}
                onRemoveVendor={handleRemoveVendor}
                skippedCategories={skippedCategories}
                onToggleSkipCategory={handleToggleSkipCategory}
              />
            </div>
          )}
        </div>

        <div className="px-4 py-4 sm:px-8 sm:py-5 border-t border-slate-100 bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-4">
            <div className="flex -space-x-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 w-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-slate-400" />
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 max-w-[240px]">
              Join <span className="text-slate-900 font-semibold">42 dealers</span> contributing to this week's intelligence report.
            </p>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3">
            {!completionStats.isComplete && vendors.length > 0 && (
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest bg-amber-50 px-2 py-1 rounded border border-amber-100 animate-pulse">
                Missing: {completionStats.missing[0]}
              </p>
            )}
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-slate-500 hover:text-slate-900"
            >
              Close
            </Button>
            <Button
              size="lg"
              onClick={handleComplete}
              disabled={saveMutation.isPending || !completionStats.isComplete}
              className={cn(
                "px-6 sm:px-8 font-bold transition-all duration-300",
                completionStats.isComplete
                  ? "bg-yellow-400 hover:bg-yellow-500 text-slate-900 shadow-lg shadow-yellow-500/20 scale-105"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              )}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              {completionStats.isComplete ? "View Dealers Like Me" : "Complete Profile"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function entryToCanvasVendor(entry: TechStackEntry): CanvasVendor {
  return {
    vendor_name: entry.vendor_name,
    category: entry.category || "Other",
    is_current: entry.is_current,
    status: entry.status,
    switching_intent: entry.switching_intent,
    exit_reasons: entry.exit_reasons.map((r) => r.reason_category),
    sentiment_score: entry.sentiment_score,
    insight_text: entry.insight_text || "",
  };
}
