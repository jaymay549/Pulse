import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface EntityMember {
  vendor_name: string;
  mention_count: number;
  is_canonical: boolean;
  alias_source: string;
}

interface VendorSplitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorName: string;
  onSplit: () => void;
}

const VendorSplitDialog = ({
  open,
  onOpenChange,
  vendorName,
  onSplit,
}: VendorSplitDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [canonicalName, setCanonicalName] = useState<string | null>(null);
  const [members, setMembers] = useState<EntityMember[]>([]);
  const [toSplit, setToSplit] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open || !vendorName) return;
    setLoading(true);
    setToSplit(new Set());

    (async () => {
      const { data, error } = await (supabase.rpc as any)(
        "admin_get_entity_members",
        { p_vendor_name: vendorName }
      );
      if (error) {
        toast.error("Failed to load entity members");
        setLoading(false);
        return;
      }
      setCanonicalName(data.canonical_name);
      setMembers(data.members || []);
      setLoading(false);
    })();
  }, [open, vendorName]);

  const toggleSplit = (name: string) => {
    setToSplit((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleSplit = async () => {
    if (toSplit.size === 0) return;
    setSaving(true);
    try {
      const { error } = await (supabase.rpc as any)("admin_split_vendor", {
        p_vendor_names: Array.from(toSplit),
      });
      if (error) throw error;

      toast.success(
        `Split ${toSplit.size} vendor${toSplit.size > 1 ? "s" : ""} from "${canonicalName}"`
      );
      queryClient.invalidateQueries({ queryKey: ["approved-mentions"] });
      onSplit();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to split vendors");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-700 text-zinc-100">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">
            Split Vendor Entity
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
          </div>
        ) : members.length === 0 ? (
          <p className="text-sm text-zinc-500 py-4">
            This vendor is not part of any entity group.
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-zinc-500">
              Entity: <strong className="text-zinc-300">{canonicalName}</strong>
              {" "}({members.length} member{members.length !== 1 ? "s" : ""})
            </p>
            <p className="text-xs text-zinc-500">
              Select vendors to detach from this entity. Their mentions will become independent.
            </p>

            <div className="space-y-1 max-h-64 overflow-y-auto">
              {members.map((m) => (
                <label
                  key={m.vendor_name}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800/60 cursor-pointer"
                >
                  <Checkbox
                    checked={toSplit.has(m.vendor_name)}
                    onCheckedChange={() => toggleSplit(m.vendor_name)}
                    disabled={m.is_canonical}
                    className="border-zinc-700 data-[state=checked]:bg-zinc-600"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-zinc-200 truncate block">
                      {m.vendor_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] text-zinc-500">
                      {m.mention_count} mention{m.mention_count !== 1 ? "s" : ""}
                    </span>
                    {m.is_canonical && (
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1.5 py-0 text-amber-400 border-amber-800"
                      >
                        primary
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1.5 py-0 text-zinc-600 border-zinc-800"
                    >
                      {m.alias_source}
                    </Badge>
                  </div>
                </label>
              ))}
            </div>

            {members.length > 0 && members.every((m) => m.is_canonical) && (
              <p className="text-[10px] text-zinc-600">
                Only the primary name is in this entity. Nothing to split.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-zinc-400"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleSplit}
            disabled={saving || toSplit.size === 0}
          >
            {saving
              ? "Splitting..."
              : `Split ${toSplit.size} Vendor${toSplit.size !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VendorSplitDialog;
