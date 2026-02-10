import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TopicCard from "@/components/admin/topics/TopicCard";
import TopicDetailPanel from "@/components/admin/topics/TopicDetailPanel";
import { useTopics, useUpdateTopic } from "@/hooks/useTopics";
import { toast } from "sonner";

const TopicModerationPage = () => {
  const [tab, setTab] = useState("review");
  const [search, setSearch] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const updateTopic = useUpdateTopic();

  // Fetch topics based on tab
  const statusFilter = tab === "review" ? undefined : tab === "rejected" ? "rejected" as const : "active" as const;
  const { data: topics, isLoading } = useTopics({ status: statusFilter, search: search || undefined });

  // For review tab, show non-rejected topics sorted by trending_score
  const displayTopics = tab === "review"
    ? topics?.filter((t) => t.status !== "rejected")
    : topics;

  const handleAction = async (id: string, action: "approve" | "reject" | "pin" | "archive") => {
    setUpdatingId(id);
    try {
      const topic = topics?.find((t) => t.id === id);
      switch (action) {
        case "approve":
          await updateTopic.mutateAsync({ id, status: "active" });
          toast.success("Topic approved");
          break;
        case "reject":
          await updateTopic.mutateAsync({ id, status: "rejected" });
          toast.success("Topic rejected");
          break;
        case "pin":
          await updateTopic.mutateAsync({ id, is_pinned: !topic?.is_pinned });
          toast.success(topic?.is_pinned ? "Unpinned" : "Pinned");
          break;
        case "archive":
          await updateTopic.mutateAsync({ id, is_archived: !topic?.is_archived });
          toast.success(topic?.is_archived ? "Unarchived" : "Archived");
          break;
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to update topic");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-4 max-w-6xl">
      <div>
        <h1 className="text-xl font-bold text-zinc-100">Topic Moderation</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Review, approve, and reject discussion topics.
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search topics..."
          className="h-8 pl-8 text-xs bg-zinc-900 border-zinc-700 text-zinc-300"
        />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="bg-zinc-900 border border-zinc-800">
          <TabsTrigger
            value="review"
            className="text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 text-zinc-500"
          >
            Moderation Queue
          </TabsTrigger>
          <TabsTrigger
            value="active"
            className="text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 text-zinc-500"
          >
            Active
          </TabsTrigger>
          <TabsTrigger
            value="rejected"
            className="text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 text-zinc-500"
          >
            Rejected
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab}>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
            </div>
          ) : !displayTopics || displayTopics.length === 0 ? (
            <p className="text-sm text-zinc-500 text-center py-8">No topics found.</p>
          ) : (
            <div className="space-y-2">
              <span className="text-xs text-zinc-500">
                {displayTopics.length} topic{displayTopics.length !== 1 ? "s" : ""}
              </span>
              {displayTopics.map((topic) => (
                <TopicCard
                  key={topic.id}
                  topic={topic}
                  onApprove={() => handleAction(topic.id, "approve")}
                  onReject={() => handleAction(topic.id, "reject")}
                  onTogglePin={() => handleAction(topic.id, "pin")}
                  onToggleArchive={() => handleAction(topic.id, "archive")}
                  onClick={() => setSelectedTopicId(topic.id)}
                  isUpdating={updatingId === topic.id}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Detail panel */}
      {selectedTopicId && (
        <TopicDetailPanel
          topicId={selectedTopicId}
          onClose={() => setSelectedTopicId(null)}
        />
      )}
    </div>
  );
};

export default TopicModerationPage;
