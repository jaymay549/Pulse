import { useState, useEffect, useMemo, useCallback } from "react";
import { useVendorAuth } from "@/hooks/useVendorAuth";
import { createVendorPortalApi, VendorMention } from "@/lib/vendorPortalApi";
import {
  Search,
  Loader2,
  MessageSquare,
  Reply,
  Edit2,
  Trash2,
} from "lucide-react";
import { Link } from "react-router-dom";

const SENTIMENT_FILTERS = [
  { id: "all", label: "All" },
  { id: "positive", label: "Positive" },
  { id: "warning", label: "Negative" },
] as const;

type SentimentFilter = (typeof SENTIMENT_FILTERS)[number]["id"];

type ComposerMode = "new" | "edit" | null;

export default function VendorReviews() {
  const { getToken, getOrgId, isPro, isLoaded, organization } = useVendorAuth();
  const api = useMemo(() => createVendorPortalApi(getToken, getOrgId), [getToken, getOrgId]);

  const [mentions, setMentions] = useState<VendorMention[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>("all");
  const limit = 20;

  const [activeMentionId, setActiveMentionId] = useState<string | null>(null);
  const [composerMode, setComposerMode] = useState<ComposerMode>(null);
  const [draft, setDraft] = useState("");
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const resetComposer = () => {
    setActiveMentionId(null);
    setComposerMode(null);
    setDraft("");
  };

  const fetchMentions = useCallback(async () => {
    if (!isLoaded || !organization) return;

    setLoading(true);
    try {
      const data = await api.getMentions({
        page,
        limit,
        search: search || undefined,
        type: sentimentFilter !== "all" ? sentimentFilter : undefined,
        includeResponses: isPro,
      });
      setMentions(data.mentions);
      setTotal(data.total);
    } catch (error) {
      console.error("Failed to load mentions:", error);
    } finally {
      setLoading(false);
    }
  }, [api, page, search, sentimentFilter, isLoaded, organization, isPro]);

  useEffect(() => {
    fetchMentions();
  }, [fetchMentions]);

  const handleOpenComposer = (mention: VendorMention, mode: ComposerMode) => {
    setActiveMentionId(mention.id);
    setComposerMode(mode);
    setDraft(mode === "edit" ? mention.response?.response_text ?? "" : "");
  };

  const handleSubmit = async (mention: VendorMention) => {
    const text = draft.trim();
    if (!text) return;

    setSubmittingId(mention.id);
    try {
      if (mention.response && composerMode === "edit") {
        await api.updateResponse(mention.response.id, text);
      } else {
        await api.createResponse(mention.id, text);
      }
      resetComposer();
      fetchMentions();
    } catch (error: any) {
      if (error?.status === 409) {
        alert("You have already responded to this mention.");
      } else {
        console.error("Failed to submit response:", error);
      }
    } finally {
      setSubmittingId(null);
    }
  };

  const handleDelete = async (responseId: number) => {
    if (!confirm("Delete this response?")) return;
    setDeletingId(responseId);
    try {
      await api.deleteResponse(responseId);
      resetComposer();
      fetchMentions();
    } catch (error) {
      console.error("Failed to delete response:", error);
    } finally {
      setDeletingId(null);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Reviews & Responses</h1>
        <p className="text-zinc-400 text-sm">
          Everything dealers are saying about your brand, with responses in the same place.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search reviews..."
            className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#FFD700]"
          />
        </div>

        <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-full p-1">
          {SENTIMENT_FILTERS.map((filter) => (
            <button
              key={filter.id}
              onClick={() => {
                setSentimentFilter(filter.id);
                setPage(1);
              }}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                sentimentFilter === filter.id
                  ? "bg-[#FFD700] text-zinc-900 font-semibold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {!isPro && (
          <Link
            to="/vendors"
            className="text-xs text-[#FFD700] hover:text-yellow-400"
          >
            Upgrade to respond
          </Link>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
        </div>
      ) : mentions.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No reviews found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {mentions.map((mention) => {
            const isActive = activeMentionId === mention.id;
            const hasResponse = !!mention.response;
            const response = mention.response;
            return (
              <div
                key={mention.id}
                className="border border-zinc-800 rounded-xl bg-zinc-900/40"
              >
                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_340px] gap-4 p-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-2.5 h-2.5 mt-2 rounded-full flex-shrink-0 ${
                          mention.type === "positive" ? "bg-green-500" : "bg-red-500"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-white">{mention.title}</span>
                          <span
                            className={`text-[11px] px-2 py-0.5 rounded-full ${
                              mention.type === "positive"
                                ? "bg-green-900/50 text-green-400"
                                : "bg-red-900/50 text-red-400"
                            }`}
                          >
                            {mention.type === "positive" ? "Positive" : "Negative"}
                          </span>
                          <span className="text-[11px] text-zinc-500 px-2 py-0.5 rounded-full bg-zinc-800">
                            {mention.category}
                          </span>
                        </div>
                        <p className="text-sm text-zinc-300 mt-2">{mention.quote}</p>
                        {mention.explanation && (
                          <p className="text-xs text-zinc-500 mt-2">{mention.explanation}</p>
                        )}
                        <div className="text-xs text-zinc-600 mt-2">
                          {new Date(mention.conversation_time).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border border-zinc-800/60 rounded-lg p-3 bg-zinc-950/50">
                    {!isPro && (
                      <div className="text-xs text-zinc-500">
                        Responses are a Pro feature. Upgrade to publish a response.
                      </div>
                    )}

                    {isPro && !isActive && !hasResponse && (
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-zinc-500">No response yet</div>
                        <button
                          onClick={() => handleOpenComposer(mention, "new")}
                          className="text-xs text-[#FFD700] hover:text-yellow-400 flex items-center gap-1"
                        >
                          <Reply className="w-3 h-3" />
                          Write response
                        </button>
                      </div>
                    )}

                    {isPro && !isActive && hasResponse && response && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-[11px] px-2 py-0.5 rounded-full ${
                              response.status === "published"
                                ? "bg-green-900/50 text-green-400"
                                : "bg-yellow-900/50 text-yellow-400"
                            }`}
                          >
                            {response.status}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleOpenComposer(mention, "edit")}
                              className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"
                            >
                              <Edit2 className="w-3 h-3" />
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(response.id)}
                              disabled={deletingId === response.id}
                              className="text-xs text-zinc-400 hover:text-red-400 flex items-center gap-1"
                            >
                              {deletingId === response.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Trash2 className="w-3 h-3" />
                              )}
                              Delete
                            </button>
                          </div>
                        </div>
                        <p className="text-sm text-zinc-200">{response.response_text}</p>
                        <div className="text-[11px] text-zinc-600">
                          {new Date(response.updated_at).toLocaleDateString()}
                          {response.updated_at !== response.created_at && " (edited)"}
                        </div>
                      </div>
                    )}

                    {isPro && isActive && (
                      <div className="space-y-2">
                        <textarea
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          placeholder="Write your response..."
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#FFD700] resize-none"
                          rows={4}
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={resetComposer}
                            className="text-xs text-zinc-400 hover:text-zinc-200 px-2"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSubmit(mention)}
                            disabled={!draft.trim() || submittingId === mention.id}
                            className="text-xs bg-[#FFD700] text-zinc-900 px-4 py-1.5 rounded-md font-semibold hover:bg-yellow-400 disabled:opacity-50"
                          >
                            {submittingId === mention.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              composerMode === "edit" ? "Save changes" : "Publish response"
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 text-zinc-400 hover:text-white disabled:opacity-30"
          >
            Prev
          </button>
          <span className="text-sm text-zinc-400">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-2 text-zinc-400 hover:text-white disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
