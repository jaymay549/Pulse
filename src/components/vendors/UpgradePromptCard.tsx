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
