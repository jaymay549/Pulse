import { useState } from "react";
import { useClerkSupabase } from "@/hooks/useClerkSupabase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { categories } from "@/hooks/useVendorFilters";
import { Building2, MapPin, ShoppingCart } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type RooftopSize = "small" | "mid-size" | "large";

interface DealerOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

/* ------------------------------------------------------------------ */
/*  Option data                                                        */
/* ------------------------------------------------------------------ */

const ROOFTOP_OPTIONS: { value: RooftopSize; label: string; desc: string }[] = [
  { value: "small", label: "Small", desc: "1\u20133 stores" },
  { value: "mid-size", label: "Mid-size", desc: "4\u201315 stores" },
  { value: "large", label: "Large", desc: "15+ stores" },
];

const REGION_OPTIONS = [
  "Northeast",
  "Southeast",
  "Midwest",
  "Southwest",
  "West",
  "Canada",
] as const;

// All categories except the "all" meta-entry
const SHOPPING_CATEGORIES = categories.filter((c) => c.id !== "all");

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function DealerOnboardingModal({
  isOpen,
  onClose,
  userId,
}: DealerOnboardingModalProps) {
  const supabase = useClerkSupabase();

  // Wizard state
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);

  // Answer state
  const [rooftopSize, setRooftopSize] = useState<RooftopSize | null>(null);
  const [region, setRegion] = useState<string | null>(null);
  const [shoppingFor, setShoppingFor] = useState<string[]>([]);

  /* ---- helpers ---- */

  function reset() {
    setStep(1);
    setRooftopSize(null);
    setRegion(null);
    setShoppingFor([]);
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      onClose();
      // Reset after close animation finishes
      setTimeout(reset, 300);
    }
  }

  function handleSkip() {
    onClose();
    setTimeout(reset, 300);
  }

  function toggleCategory(id: string) {
    setShoppingFor((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  }

  function canAdvance(): boolean {
    if (step === 1) return rooftopSize !== null;
    if (step === 2) return region !== null;
    return true; // step 3 is optional
  }

  function handleNext() {
    if (step === 1 && rooftopSize) setStep(2);
    else if (step === 2 && region) setStep(3);
  }

  async function handleSave() {
    if (!rooftopSize || !region) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("dealer_profiles" as never).upsert(
        {
          user_id: userId,
          rooftop_size: rooftopSize,
          region,
          shopping_for: shoppingFor,
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: "user_id" } as never,
      );
      if (error) throw error;
      toast.success("Profile saved \u2014 we\u2019ll personalize your experience.");
      onClose();
      setTimeout(reset, 300);
    } catch (err) {
      console.error(err);
      toast.error("Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  /* ---- step titles ---- */

  const stepMeta: Record<1 | 2 | 3, { icon: React.ReactNode; title: string; description: string }> = {
    1: {
      icon: <Building2 className="h-5 w-5 text-[#FFD700]" />,
      title: "How many rooftops do you operate?",
      description: "This helps us show you solutions sized for your group.",
    },
    2: {
      icon: <MapPin className="h-5 w-5 text-[#FFD700]" />,
      title: "What region are you in?",
      description: "We\u2019ll surface vendors popular in your area.",
    },
    3: {
      icon: <ShoppingCart className="h-5 w-5 text-[#FFD700]" />,
      title: "What are you shopping for?",
      description: "Select any categories you\u2019re exploring. You can skip this.",
    },
  };

  const meta = stepMeta[step];

  /* ---- render ---- */

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          "sm:max-w-md border-zinc-800 bg-zinc-900 text-zinc-100",
          "[&>button]:text-zinc-400 [&>button]:hover:text-white",
        )}
      >
        {/* Progress bar */}
        <div className="flex items-center gap-1.5 mb-1">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                s <= step ? "bg-[#FFD700]" : "bg-zinc-700",
              )}
            />
          ))}
        </div>
        <p className="text-xs text-zinc-500 mb-2">Step {step} of 3</p>

        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-zinc-100">
            {meta.icon}
            {meta.title}
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            {meta.description}
          </DialogDescription>
        </DialogHeader>

        {/* ---- Step 1: Rooftop size ---- */}
        {step === 1 && (
          <div className="grid gap-2 mt-2">
            {ROOFTOP_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRooftopSize(opt.value)}
                className={cn(
                  "flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors",
                  rooftopSize === opt.value
                    ? "border-[#FFD700] bg-[#FFD700]/10 text-white"
                    : "border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:border-zinc-500",
                )}
              >
                <span className="font-medium">{opt.label}</span>
                <span className="text-sm text-zinc-400">{opt.desc}</span>
              </button>
            ))}
          </div>
        )}

        {/* ---- Step 2: Region ---- */}
        {step === 2 && (
          <div className="grid grid-cols-2 gap-2 mt-2">
            {REGION_OPTIONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRegion(r)}
                className={cn(
                  "rounded-lg border px-4 py-3 text-sm font-medium transition-colors",
                  region === r
                    ? "border-[#FFD700] bg-[#FFD700]/10 text-white"
                    : "border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:border-zinc-500",
                )}
              >
                {r}
              </button>
            ))}
          </div>
        )}

        {/* ---- Step 3: Categories (multi-select) ---- */}
        {step === 3 && (
          <div className="flex flex-wrap gap-2 mt-2 max-h-60 overflow-y-auto pr-1">
            {SHOPPING_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => toggleCategory(cat.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                  shoppingFor.includes(cat.id)
                    ? "border-[#FFD700] bg-[#FFD700]/10 text-white"
                    : "border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200",
                )}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* ---- Footer ---- */}
        <div className="flex items-center justify-between mt-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
            onClick={handleSkip}
          >
            Skip
          </Button>

          <div className="flex items-center gap-2">
            {step > 1 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-white"
                onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
              >
                Back
              </Button>
            )}

            {step < 3 ? (
              <Button
                type="button"
                size="sm"
                disabled={!canAdvance()}
                className="bg-[#FFD700] text-zinc-900 hover:bg-yellow-400 disabled:opacity-40"
                onClick={handleNext}
              >
                Next
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                disabled={saving}
                className="bg-[#FFD700] text-zinc-900 hover:bg-yellow-400 disabled:opacity-40"
                onClick={handleSave}
              >
                {saving ? "Saving\u2026" : "Save"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
