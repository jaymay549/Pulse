import { Sparkles, X } from "lucide-react";
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
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className={cn(
          "bg-white rounded-2xl overflow-hidden",
          "shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_4px_24px_-4px_rgba(0,0,0,0.08)]",
          className
        )}
      >
        <div className="p-6 text-center relative">
          <button
            onClick={onDismiss}
            className="absolute top-3 right-3 h-7 w-7 flex items-center justify-center rounded-lg text-foreground/25 hover:text-foreground/60 hover:bg-black/[0.04] transition-all"
          >
            <X className="h-3.5 w-3.5" />
          </button>

          <div className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-amber-100/80 mb-3">
            <Sparkles className="h-5 w-5 text-amber-600" />
          </div>

          <h3 className="text-base font-bold text-foreground mb-1 tracking-tight">
            AI Vendor Advisor is a Pro feature
          </h3>
          <p className="text-[13px] text-foreground/45 mb-5 max-w-xs mx-auto">
            Get instant answers about vendors, comparisons, and recommendations.
          </p>

          <button
            onClick={onUpgrade}
            className="px-5 py-2 rounded-xl bg-foreground text-white text-[13px] font-semibold hover:bg-foreground/80 transition-colors"
          >
            Upgrade to Pro
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
