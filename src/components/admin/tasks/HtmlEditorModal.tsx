import { useState, useEffect } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWamApi } from "@/hooks/useWamApi";
import { fetchOccurrenceHtml } from "@/hooks/useAdminData";

interface HtmlEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  occurrenceId: number | null;
  onSaved?: () => void;
}

const HtmlEditorModal = ({
  open,
  onOpenChange,
  occurrenceId,
  onSaved,
}: HtmlEditorModalProps) => {
  const wam = useWamApi();
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);

  useEffect(() => {
    if (!open || !occurrenceId) return;
    setLoading(true);
    fetchOccurrenceHtml(occurrenceId)
      .then((html) => setHtml(html))
      .catch(() => setHtml(""))
      .finally(() => setLoading(false));
  }, [open, occurrenceId]);

  // Debounced preview update
  useEffect(() => {
    const timer = setTimeout(() => setPreviewKey((k) => k + 1), 500);
    return () => clearTimeout(timer);
  }, [html]);

  const handleSave = async () => {
    if (!occurrenceId) return;
    setSaving(true);
    try {
      await wam.updateOccurrenceHtml(occurrenceId, html);
      onSaved?.();
      onOpenChange(false);
    } catch {}
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-700 max-w-6xl h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-4 py-3 border-b border-zinc-800 flex-row items-center justify-between">
          <DialogTitle className="text-zinc-100 text-sm">
            Edit Occurrence HTML
          </DialogTitle>
          <Button
            onClick={handleSave}
            disabled={saving || loading}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
            ) : (
              <Save className="h-3.5 w-3.5 mr-1" />
            )}
            Save & Regenerate PDF
          </Button>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center flex-1">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-2 gap-0 min-h-0">
            {/* Editor */}
            <div className="border-r border-zinc-800 flex flex-col">
              <div className="px-3 py-1.5 border-b border-zinc-800 text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                HTML Editor
              </div>
              <Textarea
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                className="flex-1 resize-none rounded-none border-0 bg-zinc-950 text-zinc-200 text-xs font-mono p-3 min-h-0"
              />
            </div>

            {/* Preview */}
            <div className="flex flex-col">
              <div className="px-3 py-1.5 border-b border-zinc-800 text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                Live Preview
              </div>
              <iframe
                key={previewKey}
                srcDoc={html}
                className="flex-1 bg-white border-0"
                title="HTML Preview"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default HtmlEditorModal;
