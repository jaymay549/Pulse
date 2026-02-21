import { useState, useEffect } from "react";
import { useClerkAuth } from "@/hooks/useClerkAuth";
import { useClerkSupabase } from "@/hooks/useClerkSupabase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface ClaimProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorName: string;
}

export function ClaimProfileModal({
  open,
  onOpenChange,
  vendorName,
}: ClaimProfileModalProps) {
  const { user } = useClerkAuth();
  const supabase = useClerkSupabase();

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset fields each time modal opens so we use latest user data
  useEffect(() => {
    if (open) {
      setName(user?.name ?? "");
      setEmail(user?.email ?? "");
    }
  }, [open, user?.name, user?.email]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("vendor_claims").insert({
        vendor_name: vendorName,
        claimant_name: name.trim(),
        claimant_email: email.trim(),
        note: note.trim() || null,
        claimant_user_id: user.id as string,
        status: "pending",
      } as never);
      if (error) throw error;
      toast.success("Claim submitted — we'll review it shortly.");
      onOpenChange(false);
      setNote("");
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit claim. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Claim {vendorName}</DialogTitle>
          <DialogDescription>
            Submit a request to verify you represent this vendor. We review all
            claims manually before granting access.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="claim-name">Your name</Label>
            <Input
              id="claim-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="claim-email">Work email</Label>
            <Input
              id="claim-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="claim-note">
              Note{" "}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="claim-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything that helps us verify your claim…"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit claim"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
