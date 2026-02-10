import { useState, useEffect } from "react";
import { Download, Send, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWamApi } from "@/hooks/useWamApi";

interface PdfPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdfId: number | null;
}

const PdfPreviewDialog = ({
  open,
  onOpenChange,
  pdfId,
}: PdfPreviewDialogProps) => {
  const wam = useWamApi();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !pdfId) return;
    setLoading(true);
    setError(null);
    wam
      .downloadPdf(pdfId)
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
      })
      .catch((e) => setError("Failed to load PDF"))
      .finally(() => setLoading(false));

    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [open, pdfId]);

  const handleDownload = () => {
    if (!blobUrl) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `export-${pdfId}.pdf`;
    a.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-700 max-w-4xl h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-4 py-3 border-b border-zinc-800 flex-row items-center justify-between">
          <DialogTitle className="text-zinc-100 text-sm">
            PDF Preview
          </DialogTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={!blobUrl}
              className="text-xs h-7 border-zinc-600 text-zinc-300"
            >
              <Download className="h-3 w-3 mr-1" />
              Download
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-red-400 text-sm">
              {error}
            </div>
          ) : blobUrl ? (
            <iframe
              src={blobUrl}
              className="w-full h-full border-0"
              title="PDF Preview"
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PdfPreviewDialog;
