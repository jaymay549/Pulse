import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  Layers,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  Sparkles,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useClerkAuth } from "@/hooks/useClerkAuth";
import {
  useTechStackEntries,
  useConfirmTechStack,
} from "@/hooks/useTechStackProfile";
import { computeTechStackCompletion } from "@/hooks/useTechStackCompletion";
import { TechStackWizard } from "./TechStackWizard";
import { useNavigate } from "react-router-dom";

const STALE_DAYS = 90;

export function ProfileProgressBar() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: isAuthLoading, user } = useClerkAuth();
  const { data: techData, isSuccess: isTechDataLoaded } = useTechStackEntries();
  const confirmMutation = useConfirmTechStack();
  const [wizardOpen, setWizardOpen] = useState(false);

  // Track when user was loaded-and-unauthenticated so we can detect a real sign-in
  // (as opposed to a page refresh where Clerk restores an existing session)
  const sawUnauthRef = useRef(false);
  const didAutoOpenRef = useRef(false);

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      sawUnauthRef.current = true;
    }
  }, [isAuthLoading, isAuthenticated]);

  // Auto-open wizard on fresh sign-in if tech stack is incomplete
  useEffect(() => {
    if (
      sawUnauthRef.current &&
      isAuthenticated &&
      isTechDataLoaded &&
      !didAutoOpenRef.current
    ) {
      const entries = techData?.entries || [];
      const skipped = techData?.skippedCategories || [];
      const { isComplete } = computeTechStackCompletion(entries, skipped);
      if (!isComplete) {
        setWizardOpen(true);
        didAutoOpenRef.current = true;
      }
    }
  }, [isAuthenticated, isTechDataLoaded, techData]);

  if (!isAuthenticated || !user) return null;

  const entries = techData?.entries || [];
  const skippedCategories = techData?.skippedCategories || [];
  const completion = computeTechStackCompletion(entries, skippedCategories);

  const isStale =
    completion.isComplete &&
    entries &&
    entries.length > 0 &&
    entries.some((e) => {
      if (!e.confirmed_at) return true;
      const confirmedAt = new Date(e.confirmed_at);
      const daysSince =
        (Date.now() - confirmedAt.getTime()) / (1000 * 60 * 60 * 24);
      return daysSince > STALE_DAYS;
    });

  return (
    <>
      <div
        className={cn(
          "relative overflow-hidden",
          isStale
            ? "bg-gradient-to-r from-amber-950 via-amber-900 to-amber-950"
            : "bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950"
        )}
      >
        {/* Subtle noise texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Gradient accent line at top */}
        <div
          className={cn(
            "absolute top-0 left-0 right-0 h-[1px]",
            isStale
              ? "bg-gradient-to-r from-transparent via-amber-400/40 to-transparent"
              : "bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent"
          )}
        />

        <div className="relative max-w-7xl mx-auto px-4 py-3">
          {isStale ? (
            <StalePrompt
              onUpdate={() => setWizardOpen(true)}
              onConfirm={() => confirmMutation.mutate()}
              isPending={confirmMutation.isPending}
            />
          ) : completion.isComplete ? (
            <CompletedPrompt
              onViewReport={() => navigate("/dealers-like-me")}
              onEdit={() => setWizardOpen(true)}
            />
          ) : (
            <ProgressPrompt
              percentage={completion.percentage}
              hasEntries={(entries?.length ?? 0) > 0}
              onAction={() => setWizardOpen(true)}
            />
          )}
        </div>
      </div>

      <TechStackWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </>
  );
}

// ── Progress state ───────────────────────────────────────────

function ProgressPrompt({
  percentage,
  hasEntries,
  onAction,
}: {
  percentage: number;
  hasEntries: boolean;
  onAction: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex items-center gap-6"
    >
      {/* Icon */}
      <div className="hidden sm:flex h-10 w-10 shrink-0 rounded-xl bg-yellow-500/10 border border-yellow-500/20 items-center justify-center shadow-lg shadow-yellow-500/5">
        <Sparkles className="h-5 w-5 text-yellow-500" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-white tracking-tight">
              {hasEntries ? "Market Intelligence Profile" : "Unlock Your Market Intelligence Report"}
            </span>
            <span className="text-xs font-bold text-yellow-400">
              {percentage}% Complete
            </span>
          </div>

          {/* Progress track */}
          <div className="w-full h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full relative"
              initial={{ width: 0 }}
              animate={{ width: `${percentage}%` }}
              transition={{ duration: 1, ease: [0.34, 1.56, 0.64, 1] }}
              style={{
                background: "linear-gradient(90deg, #FDD835, #FACC15)",
              }}
            >
              {/* Subtle glow effect */}
              <div className="absolute inset-y-0 right-0 w-4 bg-yellow-400 blur-md opacity-50" />
            </motion.div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <button
        type="button"
        onClick={onAction}
        className="group shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-slate-950 bg-yellow-400 hover:bg-yellow-300 shadow-lg shadow-yellow-500/20 transition-all hover:scale-105 active:scale-95"
      >
        {hasEntries ? (
          <>
            Complete Profile
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </>
        ) : (
          <>
            Build Your Stack
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </>
        )}
      </button>
    </motion.div>
  );
}

// ── Staleness state ──────────────────────────────────────────

function StalePrompt({
  onUpdate,
  onConfirm,
  isPending,
}: {
  onUpdate: () => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex items-center gap-4"
    >
      {/* Icon */}
      <div className="hidden sm:flex h-8 w-8 shrink-0 rounded-lg bg-amber-400/10 border border-amber-400/20 items-center justify-center">
        <RefreshCw className="h-4 w-4 text-amber-400" />
      </div>

      {/* Copy */}
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-amber-100/90">
          Is your tech stack still accurate?
        </span>
        <p className="text-xs text-amber-200/40 mt-0.5 hidden sm:block">
          It's been a while — a quick check keeps your insights fresh
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onUpdate}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-200/80 border border-amber-400/20 hover:bg-amber-400/10 transition-colors"
        >
          Update
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isPending}
          className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-950 bg-gradient-to-b from-amber-300 to-amber-400 hover:from-amber-200 hover:to-amber-300 shadow-sm shadow-black/20 transition-all active:scale-[0.97] disabled:opacity-60"
        >
          {isPending ? (
            "Confirming..."
          ) : (
            <>
              <CheckCircle2 className="h-3.5 w-3.5" />
              Still accurate
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}

function CompletedPrompt({
  onViewReport,
  onEdit,
}: {
  onViewReport: () => void;
  onEdit: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex items-center gap-4"
    >
      <div className="hidden sm:flex h-8 w-8 shrink-0 rounded-lg bg-emerald-400/10 border border-emerald-400/20 items-center justify-center">
        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
      </div>

      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-emerald-100/90">
          Profile complete. See how your stack compares.
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-200/80 border border-emerald-400/20 hover:bg-emerald-400/10 transition-colors"
        >
          Edit Stack
        </button>
        <button
          type="button"
          onClick={onViewReport}
          className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-950 bg-gradient-to-b from-yellow-300 to-yellow-400 hover:from-yellow-200 hover:to-yellow-300 shadow-sm shadow-black/20 transition-all active:scale-[0.97]"
        >
          <Users className="h-3.5 w-3.5" />
          View Dealers Like Me
        </button>
      </div>
    </motion.div>
  );
}
