import { useState } from "react";
import { TrendingUp, Loader2, MessageSquare, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTrendReport, useTopicMessages } from "@/hooks/useAdminData";
import type { TrendReport, TrendTopic } from "@/types/admin";

const CATEGORIES = [
  "All Topics",
  "Market Pulse",
  "Fixed Operations",
  "Operations",
  "Technology & DMS",
  "F&I",
  "Other",
];

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "text-green-400 bg-green-900/30",
  negative: "text-red-400 bg-red-900/30",
  neutral: "text-zinc-400 bg-zinc-800",
  mixed: "text-amber-400 bg-amber-900/30",
};

const TrendsPage = () => {
  const [reportType, setReportType] = useState<"daily" | "weekly">("daily");
  const [category, setCategory] = useState("All Topics");
  const [selectedTopic, setSelectedTopic] = useState<TrendTopic | null>(null);

  const { data: report = null, isLoading: loading } = useTrendReport(reportType);

  const { data: topicMessages = [], isLoading: loadingMessages } = useTopicMessages(
    selectedTopic?.title || null,
    report?.date_range_start || null,
    report?.date_range_end || null
  );

  const safeTopics = Array.isArray(report?.topics) ? report.topics : [];

  const topics = safeTopics.filter(
    (t) => category === "All Topics" || t.category === category
  );

  const handleTopicClick = (topic: TrendTopic) => {
    setSelectedTopic(topic);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-100">Trends</h1>
        <Tabs value={reportType} onValueChange={(v) => setReportType(v as "daily" | "weekly")}>
          <TabsList className="bg-zinc-800">
            <TabsTrigger value="daily" className="text-xs">Daily</TabsTrigger>
            <TabsTrigger value="weekly" className="text-xs">Weekly</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {report && (
        <div className="text-xs text-zinc-500">
          {new Date(report.date_range_start).toLocaleDateString()} –{" "}
          {new Date(report.date_range_end).toLocaleDateString()}
          {report.overall_sentiment && (
            <span className="ml-3">
              Overall: <span className="text-zinc-300">{report.overall_sentiment}</span>
            </span>
          )}
        </div>
      )}

      {/* Category filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
              category === cat
                ? "bg-zinc-700 text-zinc-100"
                : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
            }`}
          >
            {cat}
            {cat !== "All Topics" && safeTopics.length > 0 && (
              <span className="ml-1 text-zinc-500">
                ({safeTopics.filter((t) => t.category === cat).length})
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex gap-6">
        {/* Topics list */}
        <div className="flex-1 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
            </div>
          ) : topics.length === 0 ? (
            <div className="text-center py-20 text-zinc-500 text-sm">
              No topics found
            </div>
          ) : (
            topics.map((topic, i) => (
              <div
                key={i}
                onClick={() => handleTopicClick(topic)}
                className={`bg-zinc-900 border rounded-lg p-4 cursor-pointer transition-colors ${
                  selectedTopic?.title === topic.title
                    ? "border-blue-600"
                    : "border-zinc-800 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-zinc-200">{topic.title}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                        {topic.category}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${SENTIMENT_COLORS[topic.sentiment] || SENTIMENT_COLORS.neutral}`}>
                        {topic.sentiment}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-500 mt-2 line-clamp-2">{topic.summary}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-zinc-600 flex-shrink-0 mt-1" />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Messages panel */}
        {selectedTopic && (
          <div className="w-80 lg:w-96 flex-shrink-0 bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-sm font-medium text-zinc-200 truncate">
                {selectedTopic.title}
              </h3>
              <button onClick={() => setSelectedTopic(null)} className="text-zinc-500 hover:text-zinc-300">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[calc(100vh-20rem)] p-3 space-y-3">
              {loadingMessages ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                </div>
              ) : topicMessages.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 text-xs">No messages</div>
              ) : (
                topicMessages.map((msg: any, i: number) => (
                  <div key={i} className="text-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-zinc-300">{msg.sender}</span>
                      <span className="text-zinc-600">{msg.groupName}</span>
                    </div>
                    <div className="text-zinc-400">{msg.content}</div>
                    <div className="text-zinc-600 mt-1">
                      {new Date(msg.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrendsPage;
