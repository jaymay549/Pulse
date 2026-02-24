import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Flag } from "lucide-react";

interface FlagMentionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mentionQuote: string;
  onSubmit: (reason: string, note: string) => void;
  isPending?: boolean;
}

const FLAG_REASONS = [
  { value: "inaccurate", label: "Factually inaccurate" },
  { value: "unfair", label: "Unfair or misleading" },
  { value: "outdated", label: "Outdated information" },
  { value: "spam", label: "Spam or irrelevant" },
  { value: "other", label: "Other" },
] as const;

export function FlagMentionModal({
  open,
  onOpenChange,
  mentionQuote,
  onSubmit,
  isPending,
}: FlagMentionModalProps) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  const handleSubmit = () => {
    if (!reason) return;
    onSubmit(reason, note);
    setReason("");
    setNote("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-amber-500" />
            Flag Mention for Review
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Mention preview */}
          <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
            <p className="text-sm text-slate-600 italic line-clamp-3">
              {mentionQuote}
            </p>
          </div>

          {/* Reason selection */}
          <div>
            <p className="text-sm font-medium mb-2">
              Why are you flagging this mention?
            </p>
            <div className="space-y-2">
              {FLAG_REASONS.map((r) => (
                <label
                  key={r.value}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="flag-reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={() => setReason(r.value)}
                    className="h-4 w-4 text-slate-900 border-slate-300 focus:ring-slate-500"
                  />
                  <span className="text-sm text-slate-700">{r.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Optional note */}
          <div>
            <p className="text-sm font-medium mb-2">
              Additional context (optional)
            </p>
            <Textarea
              placeholder="Explain why this mention should be reviewed..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Info */}
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
            <p className="text-xs text-blue-800">
              Flagged mentions are reviewed by CDG admins. You can flag up to 5
              mentions per month. Hidden mentions still count in aggregate
              sentiment.
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!reason || isPending}>
              {isPending ? "Submitting..." : "Submit Flag"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
