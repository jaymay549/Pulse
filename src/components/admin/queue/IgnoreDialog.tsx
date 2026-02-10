import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface IgnoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorName: string;
  category?: string;
}

const IgnoreDialog = ({
  open,
  onOpenChange,
  vendorName,
  category,
}: IgnoreDialogProps) => {
  const [pattern, setPattern] = useState(vendorName);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("vendor_ignores").insert({
        pattern,
        reason: reason || null,
        category: category || null,
      });
      if (error) throw error;
      toast.success(`Added "${pattern}" to ignore list`);
      onOpenChange(false);
      setReason("");
    } catch (err: any) {
      toast.error(err.message || "Failed to add to ignore list");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-700 text-zinc-100">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Add to Ignore List</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-zinc-400">Pattern</Label>
            <Input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-zinc-100"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-zinc-400">Reason (optional)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why should this be ignored?"
              className="bg-zinc-800 border-zinc-700 text-zinc-100 resize-none"
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-zinc-400"
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !pattern.trim()}>
            {saving ? "Adding..." : "Add to Ignore List"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default IgnoreDialog;
