import { useMemo, useState } from "react";
import { Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import QueueItemCard from "./QueueItemCard";
import AIReasoningModal from "./AIReasoningModal";
import IgnoreDialog from "./IgnoreDialog";
import { useQueueItems, useApproveMention, useUndoApproveMention } from "@/hooks/useVendorQueue";
import { useWamApi } from "@/hooks/useWamApi";
import { fetchQueueItemThinking } from "@/hooks/useAdminData";
import { toast } from "sonner";
import type { QueueItemMention, QueueStatus, VendorQueueItem } from "@/types/admin";

const ConversationView = () => {
  const [statusFilter, setStatusFilter] = useState<QueueStatus | "all">("all");
  const { data: items, isLoading } = useQueueItems(statusFilter);
  const approveMutation = useApproveMention();
  const undoMutation = useUndoApproveMention();
  const wamApi = useWamApi();

  // AI reasoning modal
  const [thinkingModal, setThinkingModal] = useState<{ open: boolean; text: string; vendor: string }>({
    open: false,
    text: "",
    vendor: "",
  });

  // Ignore dialog
  const [ignoreDialog, setIgnoreDialog] = useState<{ open: boolean; vendorName: string; category?: string }>({
    open: false,
    vendorName: "",
  });

  // Track locally approved mention keys to update UI optimistically
  const [localApproved, setLocalApproved] = useState<Set<string>>(new Set());

  const mentionKey = (m: QueueItemMention) =>
    `${m.vendor_name}::${m.dimension}::${m.sentiment}::${m.snippet_anon?.slice(0, 40)}`;

  const handleApprove = async (mention: QueueItemMention) => {
    try {
      await approveMutation.mutateAsync({
        vendor_name: mention.vendor_name,
        category: mention.category,
        headline: mention.headline,
        dimension: mention.dimension,
        sentiment: mention.sentiment,
        snippet_anon: mention.snippet_anon,
        message_ids: mention.message_ids || [],
      });
      setLocalApproved((prev) => new Set(prev).add(mentionKey(mention)));
      toast.success(`Approved: ${mention.vendor_name}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to approve mention");
    }
  };

  const handleUndo = async (mention: QueueItemMention) => {
    if (!mention.approved_mention_id) return;
    try {
      await undoMutation.mutateAsync(mention.approved_mention_id);
      setLocalApproved((prev) => {
        const next = new Set(prev);
        next.delete(mentionKey(mention));
        return next;
      });
      toast.success(`Undid approval: ${mention.vendor_name}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to undo");
    }
  };

  const handleReject = (mention: QueueItemMention, addToIgnore: boolean) => {
    if (addToIgnore) {
      setIgnoreDialog({ open: true, vendorName: mention.vendor_name, category: mention.category });
    }
    toast.info(`Rejected: ${mention.vendor_name}`);
  };

  // Batch processing
  const [batchProcessing, setBatchProcessing] = useState(false);

  const handleProcess = async (id: number) => {
    try {
      await wamApi.processQueueItem(id);
      toast.success("Processing started");
    } catch {
      toast.error("Failed to start processing");
    }
  };

  const handleBatchProcess = async () => {
    if (!items) return;
    const pendingIds = items.filter((i) => i.status === "pending").map((i) => i.id);
    if (pendingIds.length === 0) {
      toast.info("No pending items to process");
      return;
    }
    setBatchProcessing(true);
    try {
      const result = await wamApi.processAllQueueItems(pendingIds);
      toast.success(`Processed ${result.processed}/${result.total} items`);
      if (result.errors?.length) {
        toast.warning(`${result.errors.length} items had errors`);
      }
    } catch {
      toast.error("Batch processing failed");
    }
    setBatchProcessing(false);
  };

  const handleDelete = async (id: number) => {
    try {
      await wamApi.deleteQueueItem(id);
      toast.success("Queue item deleted");
    } catch {
      toast.error("Failed to delete item");
    }
  };

  const handleShowItemThinking = async (id: number) => {
    try {
      const thinking = await fetchQueueItemThinking(id);
      setThinkingModal({ open: true, text: thinking, vendor: `Queue Item #${id}` });
    } catch {
      toast.error("Failed to load thinking data");
    }
  };

  // Group items by date
  const grouped = useMemo(() => {
    if (!items) return [];
    const map = new Map<string, VendorQueueItem[]>();
    for (const item of items) {
      const date = new Date(item.created_at).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(item);
    }
    return Array.from(map.entries());
  }, [items]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-40 h-8 text-xs bg-zinc-900 border-zinc-700 text-zinc-300">
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700">
            <SelectItem value="all" className="text-zinc-300 text-xs">All Statuses</SelectItem>
            <SelectItem value="pending" className="text-zinc-300 text-xs">Pending</SelectItem>
            <SelectItem value="processing" className="text-zinc-300 text-xs">Processing</SelectItem>
            <SelectItem value="processed" className="text-zinc-300 text-xs">Processed</SelectItem>
            <SelectItem value="failed" className="text-zinc-300 text-xs">Failed</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-zinc-500">
          {items?.length || 0} item{items?.length !== 1 ? "s" : ""}
        </span>
        {items && items.some((i) => i.status === "pending") && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs border-zinc-700 text-zinc-300 ml-auto"
            onClick={handleBatchProcess}
            disabled={batchProcessing}
          >
            {batchProcessing ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <Play className="h-3 w-3 mr-1" />
            )}
            Process All Pending
          </Button>
        )}
      </div>

      {/* Grouped items */}
      {grouped.length === 0 ? (
        <p className="text-sm text-zinc-500 text-center py-8">No queue items found.</p>
      ) : (
        grouped.map(([date, dateItems]) => (
          <div key={date} className="space-y-2">
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider sticky top-0 bg-zinc-950/80 backdrop-blur-sm py-1">
              {date}
            </h3>
            {dateItems.map((item) => (
              <QueueItemCard
                key={item.id}
                item={item}
                onApproveMention={handleApprove}
                onRejectMention={handleReject}
                onUndoMention={handleUndo}
                onProcessItem={handleProcess}
                onDeleteItem={handleDelete}
                onShowItemThinking={handleShowItemThinking}
                onShowThinking={(text, vendor) =>
                  setThinkingModal({ open: true, text, vendor })
                }
                approvedMentionIds={localApproved}
              />
            ))}
          </div>
        ))
      )}

      {/* Modals */}
      <AIReasoningModal
        open={thinkingModal.open}
        onOpenChange={(open) => setThinkingModal((prev) => ({ ...prev, open }))}
        thinking={thinkingModal.text}
        vendorName={thinkingModal.vendor}
      />
      <IgnoreDialog
        open={ignoreDialog.open}
        onOpenChange={(open) => setIgnoreDialog((prev) => ({ ...prev, open }))}
        vendorName={ignoreDialog.vendorName}
        category={ignoreDialog.category}
      />
    </div>
  );
};

export default ConversationView;
