import { useState } from "react";
import { X, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useGroupMessages } from "@/hooks/useAdminGroups";
import type { WhatsAppGroup } from "@/types/admin";

interface GroupDetailSheetProps {
  group: WhatsAppGroup | null;
  onClose: () => void;
}

const GroupDetailSheet = ({ group, onClose }: GroupDetailSheetProps) => {
  const [search, setSearch] = useState("");
  const { data: messages, isLoading } = useGroupMessages(group?.id || null);

  if (!group) return null;

  const filtered = search.trim()
    ? messages?.filter(
        (m) =>
          m.content.toLowerCase().includes(search.toLowerCase()) ||
          m.sender.toLowerCase().includes(search.toLowerCase())
      )
    : messages;

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-zinc-950 border-l border-zinc-800 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-zinc-100 truncate">{group.name}</h2>
          <p className="text-[10px] text-zinc-600 truncate">{group.whatsapp_id}</p>
        </div>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-zinc-500" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Search */}
      <div className="px-4 py-2 border-b border-zinc-800">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search messages..."
            className="h-7 pl-8 text-xs bg-zinc-900 border-zinc-700 text-zinc-300"
          />
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
          </div>
        ) : !filtered || filtered.length === 0 ? (
          <p className="text-xs text-zinc-600 text-center py-8">No messages found.</p>
        ) : (
          <div className="p-4 space-y-3">
            {filtered.map((msg) => (
              <div key={msg.id} className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium text-zinc-400">{msg.sender}</span>
                  <span className="text-[9px] text-zinc-700">
                    {new Date(msg.timestamp).toLocaleString("en-GB", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed">{msg.content}</p>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default GroupDetailSheet;
