import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AIReasoningModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  thinking: string | null;
  vendorName?: string;
}

const AIReasoningModal = ({
  open,
  onOpenChange,
  thinking,
  vendorName,
}: AIReasoningModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-zinc-900 border-zinc-700 text-zinc-100">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">
            AI Reasoning{vendorName ? ` — ${vendorName}` : ""}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          <pre className="text-xs text-zinc-400 whitespace-pre-wrap font-mono leading-relaxed p-4">
            {thinking || "No reasoning data available."}
          </pre>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default AIReasoningModal;
