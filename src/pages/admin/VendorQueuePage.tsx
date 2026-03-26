import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQueueStats } from "@/hooks/useVendorQueue";
import ConversationView from "@/components/admin/queue/ConversationView";
import VendorView from "@/components/admin/queue/VendorView";
import MentionsSearchView from "@/components/admin/queue/MentionsSearchView";
import FlaggedMentionsView from "@/components/admin/queue/FlaggedMentionsView";
import LinkSuggestionsView from "@/components/admin/queue/LinkSuggestionsView";
import VersionInfoPanel from "@/components/admin/queue/VersionInfoPanel";

const VendorQueuePage = () => {
  const { data: stats, isLoading: statsLoading } = useQueueStats();

  return (
    <div className="space-y-4 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">Vendor Processing Queue</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Review AI-extracted vendor discussions and approve them for the public feed.
          </p>
        </div>

        {/* Stats */}
        {statsLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-zinc-500 mt-1" />
        ) : stats ? (
          <div className="flex items-center gap-3 text-xs flex-shrink-0">
            <Stat label="Total" value={stats.total} />
            <Stat label="Pending" value={stats.pending} className="text-amber-400" />
            <Stat label="Processed" value={stats.processed} className="text-green-400" />
            <Stat label="Failed" value={stats.failed} className="text-red-400" />
          </div>
        ) : null}
      </div>

      {/* Version info */}
      <VersionInfoPanel />

      {/* Tabs */}
      <Tabs defaultValue="conversation" className="w-full">
        <TabsList className="bg-zinc-900 border border-zinc-800">
          <TabsTrigger
            value="conversation"
            className="text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 text-zinc-500"
          >
            Conversations
          </TabsTrigger>
          <TabsTrigger
            value="vendor"
            className="text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 text-zinc-500"
          >
            Vendors
          </TabsTrigger>
          <TabsTrigger
            value="search"
            className="text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 text-zinc-500"
          >
            Search Discussions
          </TabsTrigger>
          <TabsTrigger
            value="flags"
            className="text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 text-zinc-500"
          >
            Flagged Discussions
          </TabsTrigger>
          <TabsTrigger
            value="links"
            className="text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 text-zinc-500"
          >
            Link Suggestions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conversation">
          <ConversationView />
        </TabsContent>
        <TabsContent value="vendor">
          <VendorView />
        </TabsContent>
        <TabsContent value="search">
          <MentionsSearchView />
        </TabsContent>
        <TabsContent value="flags">
          <FlaggedMentionsView />
        </TabsContent>
        <TabsContent value="links">
          <LinkSuggestionsView />
        </TabsContent>
      </Tabs>
    </div>
  );
};

function Stat({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className="text-center">
      <div className={`font-semibold text-sm ${className || "text-zinc-300"}`}>{value}</div>
      <div className="text-zinc-600 text-[10px]">{label}</div>
    </div>
  );
}

export default VendorQueuePage;
