import { useState, useEffect, useMemo } from "react";
import { useVendorAuth } from "@/hooks/useVendorAuth";
import { createVendorPortalApi, VendorResponseItem } from "@/lib/vendorPortalApi";
import { Navigate } from "react-router-dom";
import {
  Loader2,
  Reply,
  Edit2,
  Trash2,
  MessageSquare,
} from "lucide-react";

export default function VendorResponses() {
  const { getToken, getOrgId, isPro } = useVendorAuth();
  const api = useMemo(() => createVendorPortalApi(getToken, getOrgId), [getToken, getOrgId]);

  const [responses, setResponses] = useState<VendorResponseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    if (!isPro) return;
    async function load() {
      try {
        const data = await api.getResponses();
        setResponses(data.responses || []);
      } catch (error) {
        console.error("Failed to load responses:", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [api, isPro]);

  if (!isPro) {
    return <Navigate to="/vendor-portal/dashboard" replace />;
  }

  const handleEdit = async (id: number) => {
    if (!editText.trim()) return;
    setSaving(true);
    try {
      await api.updateResponse(id, editText.trim());
      setResponses((prev) =>
        prev.map((r) => (r.id === id ? { ...r, response_text: editText.trim() } : r))
      );
      setEditingId(null);
      setEditText("");
    } catch (error) {
      console.error("Failed to update response:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this response?")) return;
    setDeletingId(id);
    try {
      await api.deleteResponse(id);
      setResponses((prev) => prev.filter((r) => r.id !== id));
    } catch (error) {
      console.error("Failed to delete response:", error);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Your Responses</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Manage your responses to dealer reviews. Published responses are visible to all users.
        </p>
      </div>

      {responses.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          <Reply className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No responses yet</p>
          <p className="text-xs mt-1">
            Go to Reviews to respond to dealer mentions about your brand.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {responses.map((response) => (
            <div
              key={response.id}
              className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="w-4 h-4 text-zinc-500" />
                    <span className="text-xs text-zinc-500">
                      Mention #{response.mention_id}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      response.status === "published"
                        ? "bg-green-900/50 text-green-400"
                        : "bg-yellow-900/50 text-yellow-400"
                    }`}>
                      {response.status}
                    </span>
                  </div>

                  {editingId === response.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#FFD700] resize-none"
                        rows={3}
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-xs text-zinc-400 hover:text-zinc-200 px-3 py-1.5"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleEdit(response.id)}
                          disabled={!editText.trim() || saving}
                          className="text-xs bg-[#FFD700] text-zinc-900 px-4 py-1.5 rounded-md font-medium hover:bg-yellow-400 disabled:opacity-50"
                        >
                          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-300">{response.response_text}</p>
                  )}

                  <span className="text-xs text-zinc-600 mt-2 block">
                    {new Date(response.created_at).toLocaleDateString()}
                    {response.updated_at !== response.created_at && " (edited)"}
                  </span>
                </div>

                {editingId !== response.id && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingId(response.id);
                        setEditText(response.response_text);
                      }}
                      className="p-1.5 text-zinc-500 hover:text-zinc-300 rounded"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(response.id)}
                      disabled={deletingId === response.id}
                      className="p-1.5 text-zinc-500 hover:text-red-400 rounded"
                      title="Delete"
                    >
                      {deletingId === response.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
