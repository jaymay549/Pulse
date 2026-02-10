import { useState, useEffect } from "react";
import { Send, Clock, Paperclip, X, Loader2, AlertCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useWamApi } from "@/hooks/useWamApi";
import { useAdminGroups } from "@/hooks/useAdminGroups";
import type { WhatsAppGroup, ScheduledMessage, PdfExport } from "@/types/admin";

const SendMessagePage = () => {
  const wam = useWamApi();
  const { data: groups = [] } = useAdminGroups();

  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [message, setMessage] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [sending, setSending] = useState(false);
  const [scheduledMessages, setScheduledMessages] = useState<any[]>([]);
  const [loadingScheduled, setLoadingScheduled] = useState(false);
  const [groupSearch, setGroupSearch] = useState("");
  const [pdfs, setPdfs] = useState<PdfExport[]>([]);
  const [attachedPdfId, setAttachedPdfId] = useState<number | null>(null);

  const loadScheduledMessages = async () => {
    setLoadingScheduled(true);
    try {
      const res = await wam.getScheduledMessages();
      setScheduledMessages(Array.isArray(res) ? res : res.messages || []);
    } catch {}
    setLoadingScheduled(false);
  };

  const loadPdfs = async () => {
    try {
      const res = await wam.listPdfs();
      setPdfs(res.exports || []);
    } catch {}
  };

  useEffect(() => {
    loadScheduledMessages();
    loadPdfs();
    const interval = setInterval(loadScheduledMessages, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSend = async () => {
    if (selectedGroupIds.length === 0 || (!message.trim() && !attachedPdfId)) return;
    setSending(true);
    try {
      await wam.sendMessage({
        groupIds: selectedGroupIds,
        message: message.trim(),
        scheduledFor: scheduledFor || undefined,
        pdfId: attachedPdfId || undefined,
      });
      setMessage("");
      setScheduledFor("");
      setAttachedPdfId(null);
      if (scheduledFor) loadScheduledMessages();
    } catch {}
    setSending(false);
  };

  const handleCancel = async (id: number) => {
    try {
      await wam.cancelScheduledMessage(id);
      setScheduledMessages((prev) => prev.filter((m: any) => m.id !== id));
    } catch {}
  };

  const toggleGroup = (id: number) => {
    setSelectedGroupIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const filteredGroups = groups.filter((g: WhatsAppGroup) =>
    g.name.toLowerCase().includes(groupSearch.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold text-zinc-100">Send Message</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compose */}
        <div className="space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-4">
            <div>
              <label className="text-xs font-medium text-zinc-400 mb-2 block">Recipients</label>
              <Input
                placeholder="Search groups..."
                value={groupSearch}
                onChange={(e) => setGroupSearch(e.target.value)}
                className="mb-2 bg-zinc-950 border-zinc-700 text-zinc-200 text-sm"
              />
              <div className="max-h-[200px] overflow-y-auto space-y-1 border border-zinc-800 rounded p-2">
                {filteredGroups.map((g: WhatsAppGroup) => (
                  <label
                    key={g.id}
                    className={`flex items-center gap-2 p-1.5 rounded text-sm cursor-pointer ${
                      selectedGroupIds.includes(g.id) ? "bg-zinc-800 text-zinc-200" : "text-zinc-400 hover:bg-zinc-800/50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedGroupIds.includes(g.id)}
                      onChange={() => toggleGroup(g.id)}
                      className="rounded border-zinc-600"
                    />
                    {g.name}
                  </label>
                ))}
              </div>
              {selectedGroupIds.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {selectedGroupIds.map((id) => {
                    const g = groups.find((x: WhatsAppGroup) => x.id === id);
                    return g ? (
                      <span key={id} className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 flex items-center gap-1">
                        {g.name}
                        <button onClick={() => toggleGroup(id)} className="text-zinc-500 hover:text-zinc-300">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ) : null;
                  })}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-400 mb-2 block">Message</label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message..."
                rows={5}
                className="bg-zinc-950 border-zinc-700 text-zinc-200 text-sm"
              />
            </div>

            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="text-xs font-medium text-zinc-400 mb-1 block">
                  <Clock className="h-3 w-3 inline mr-1" />
                  Schedule (optional)
                </label>
                <Input
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  className="bg-zinc-950 border-zinc-700 text-zinc-200 text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-zinc-400 mb-1 block">
                  <Paperclip className="h-3 w-3 inline mr-1" />
                  Attach PDF
                </label>
                <select
                  value={attachedPdfId || ""}
                  onChange={(e) => setAttachedPdfId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full h-9 rounded-md bg-zinc-950 border border-zinc-700 text-zinc-200 text-sm px-2"
                >
                  <option value="">None</option>
                  {pdfs.map((pdf) => (
                    <option key={pdf.id} value={pdf.id}>
                      {pdf.title || pdf.filename} ({new Date(pdf.created_at).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Button
              onClick={handleSend}
              disabled={sending || selectedGroupIds.length === 0 || (!message.trim() && !attachedPdfId)}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {scheduledFor ? "Schedule" : "Send Now"}
            </Button>
          </div>
        </div>

        {/* Scheduled messages */}
        <div>
          <h2 className="text-sm font-medium text-zinc-300 mb-3">Scheduled Messages</h2>
          {loadingScheduled ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
            </div>
          ) : scheduledMessages.length === 0 ? (
            <div className="text-sm text-zinc-500 text-center py-12 bg-zinc-900 border border-zinc-800 rounded-lg">
              No scheduled messages
            </div>
          ) : (
            <div className="space-y-2">
              {scheduledMessages.map((msg: any) => {
                const isPast = new Date(msg.scheduled_for || msg.scheduledFor) < new Date();
                return (
                  <div key={msg.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-zinc-500 mb-1">
                          {msg.group_names?.join(", ") || "Unknown groups"}
                        </div>
                        <div className="text-sm text-zinc-300 line-clamp-2">{msg.message}</div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Clock className="h-3 w-3 text-zinc-500" />
                          <span className={`text-xs ${isPast ? "text-amber-400" : "text-zinc-400"}`}>
                            {new Date(msg.scheduled_for || msg.scheduledFor).toLocaleString()}
                            {isPast && " (overdue)"}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancel(msg.id)}
                        disabled={isPast}
                        className="h-7 w-7 p-0 text-zinc-500 hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SendMessagePage;
