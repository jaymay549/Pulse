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
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface VendorMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorNames: string[];
  onMerged: () => void;
}

const VendorMergeDialog = ({
  open,
  onOpenChange,
  vendorNames,
  onMerged,
}: VendorMergeDialogProps) => {
  const [canonicalName, setCanonicalName] = useState(vendorNames[0] || "");
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const aliases = vendorNames.filter(
    (n) => n.toLowerCase() !== canonicalName.toLowerCase()
  );

  const handleMerge = async () => {
    if (!canonicalName.trim()) return;
    setSaving(true);
    try {
      const { error } = await (supabase.rpc as any)("admin_merge_vendors", {
        p_canonical_name: canonicalName.trim(),
        p_aliases: aliases,
      });
      if (error) throw error;

      toast.success(`Merged ${vendorNames.length} vendors as "${canonicalName}"`);
      queryClient.invalidateQueries({ queryKey: ["approved-mentions"] });
      onMerged();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to merge vendors");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-700 text-zinc-100">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Merge Vendors</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-zinc-400">Canonical Name</Label>
            <Input
              value={canonicalName}
              onChange={(e) => setCanonicalName(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-zinc-100"
              placeholder="Primary vendor name"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-zinc-400">
              Aliases ({aliases.length})
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {vendorNames.map((name) => (
                <Badge
                  key={name}
                  variant="outline"
                  className={`text-xs cursor-pointer ${
                    name.toLowerCase() === canonicalName.toLowerCase()
                      ? "bg-zinc-700 text-zinc-100 border-zinc-600"
                      : "text-zinc-400 border-zinc-700 hover:border-zinc-600"
                  }`}
                  onClick={() => setCanonicalName(name)}
                >
                  {name}
                  {name.toLowerCase() === canonicalName.toLowerCase() && (
                    <span className="ml-1 text-[9px]">(primary)</span>
                  )}
                </Badge>
              ))}
            </div>
            <p className="text-[10px] text-zinc-600">
              Click a name to make it the canonical name. Others become aliases.
            </p>
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
          <Button
            onClick={handleMerge}
            disabled={saving || !canonicalName.trim() || vendorNames.length < 2}
          >
            {saving ? "Merging..." : "Merge Vendors"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VendorMergeDialog;
