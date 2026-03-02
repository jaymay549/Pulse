import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSubmitVendor } from "@/hooks/useTechStackProfile";

interface AddVendorInlineProps {
  onSubmit: (vendorName: string) => void;
  onCancel: () => void;
}

export function AddVendorInline({ onSubmit, onCancel }: AddVendorInlineProps) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const submitMutation = useSubmitVendor();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    await submitMutation.mutateAsync({
      vendor_name: name.trim(),
      website_url: url.trim() || undefined,
    });

    onSubmit(name.trim());
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-4"
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <Label htmlFor="vendor-name" className="text-xs text-slate-600">
            Vendor Name *
          </Label>
          <Input
            id="vendor-name"
            className="mt-1 h-9 text-sm"
            placeholder="e.g. Acme DMS"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        <div>
          <Label htmlFor="vendor-url" className="text-xs text-slate-600">
            Website (optional)
          </Label>
          <Input
            id="vendor-url"
            className="mt-1 h-9 text-sm"
            placeholder="https://..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
        <div className="flex gap-2 justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={!name.trim() || submitMutation.isPending}
          >
            {submitMutation.isPending ? (
              <>
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                Adding...
              </>
            ) : (
              "Add Vendor"
            )}
          </Button>
        </div>
      </form>
    </motion.div>
  );
}
