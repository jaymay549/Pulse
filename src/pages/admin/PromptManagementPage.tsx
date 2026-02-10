import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import PromptEditor from "@/components/admin/prompts/PromptEditor";
import VersionHistory from "@/components/admin/prompts/VersionHistory";
import VendorProcessorTab from "@/components/admin/prompts/VendorProcessorTab";
import {
  usePromptsByTimeframe,
  useActivePrompt,
  useAllTimeframes,
} from "@/hooks/usePrompts";
import type { PromptTimeframe } from "@/types/admin";

const TIMEFRAME_LABELS: Record<string, string> = {
  last1day: "Last 1 Day",
  last7days: "Last 7 Days",
  all: "All Time",
  custom: "Custom",
};

const PromptManagementPage = () => {
  const [timeframe, setTimeframe] = useState<PromptTimeframe>("last7days");
  const { data: timeframes } = useAllTimeframes();
  const { data: versions, isLoading: versionsLoading } = usePromptsByTimeframe(timeframe);
  const { data: activePrompt, isLoading: activeLoading } = useActivePrompt(timeframe);

  return (
    <div className="space-y-4 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-zinc-100">Prompt Management</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Manage AI prompts with versioning for summaries and vendor processing.
        </p>
      </div>

      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="bg-zinc-900 border border-zinc-800">
          <TabsTrigger
            value="summary"
            className="text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 text-zinc-500"
          >
            Summary Prompts
          </TabsTrigger>
          <TabsTrigger
            value="processor"
            className="text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 text-zinc-500"
          >
            Vendor Processor
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          {/* Timeframe selector */}
          <div className="flex items-center gap-3">
            <Select value={timeframe} onValueChange={(v) => setTimeframe(v as PromptTimeframe)}>
              <SelectTrigger className="w-44 h-8 text-xs bg-zinc-900 border-zinc-700 text-zinc-300">
                <SelectValue placeholder="Select timeframe" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-700">
                {(timeframes || ["last1day", "last7days", "all", "custom"]).map((tf) => (
                  <SelectItem key={tf} value={tf} className="text-zinc-300 text-xs">
                    {TIMEFRAME_LABELS[tf] || tf}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {versionsLoading && <Loader2 className="h-3 w-3 animate-spin text-zinc-500" />}
          </div>

          {/* Editor */}
          {activeLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
            </div>
          ) : (
            <PromptEditor activePrompt={activePrompt || null} timeframe={timeframe} />
          )}

          {/* Version history */}
          {versions && <VersionHistory versions={versions} />}
        </TabsContent>

        <TabsContent value="processor">
          <VendorProcessorTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PromptManagementPage;
