import { useState } from "react";
import { History, Trash2, Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWamApi } from "@/hooks/useWamApi";
import { useChatConversations } from "@/hooks/useAdminData";
import { useQueryClient } from "@tanstack/react-query";
import type { ChatConversation } from "@/types/admin";

interface ChatHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoadConversation: (conversation: ChatConversation) => void;
  currentConversationId: number | null;
}

const ChatHistory = ({
  open,
  onOpenChange,
  onLoadConversation,
  currentConversationId,
}: ChatHistoryProps) => {
  const wam = useWamApi();
  const queryClient = useQueryClient();
  const { data: conversations = [], isLoading: loading } = useChatConversations(open);
  const [deleting, setDeleting] = useState<number | null>(null);

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleting(id);
    try {
      await wam.deleteConversation(id);
      queryClient.invalidateQueries({ queryKey: ["admin-chat-conversations"] });
    } catch {
      // ignore
    }
    setDeleting(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-700 max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-zinc-100 flex items-center gap-2">
            <History className="h-5 w-5" />
            Chat History
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 text-sm">
              No saved conversations
            </div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => {
                  onLoadConversation(conv);
                  onOpenChange(false);
                }}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  conv.id === currentConversationId
                    ? "bg-zinc-800 border border-zinc-600"
                    : "hover:bg-zinc-800/50 border border-transparent"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-zinc-200 truncate">
                      {conv.title || "Untitled"}
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      {conv.group_names?.slice(0, 3).join(", ")}
                      {(conv.group_names?.length || 0) > 3 &&
                        ` +${conv.group_names.length - 3}`}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {conv.messages?.length || 0} messages
                      </span>
                      <span>
                        {new Date(conv.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => handleDelete(conv.id, e)}
                    disabled={deleting === conv.id}
                    className="h-7 w-7 p-0 text-zinc-500 hover:text-red-400"
                  >
                    {deleting === conv.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ChatHistory;
