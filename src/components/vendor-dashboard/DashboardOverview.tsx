import { useQuery } from "@tanstack/react-query";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useClerkSupabase } from "@/hooks/useClerkSupabase";
import { fetchVendorPulseFeed } from "@/hooks/useSupabaseVendorData";
import { PulseBriefing } from "./PulseBriefing";
import { NPSChart } from "./NPSChart";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingUp, BarChart2, MessageSquare, Clock } from "lucide-react";

interface DashboardOverviewProps {
  vendorName: string;
  onNavigate: (section: string) => void;
}

interface VendorMention {
  id: string;
  quote: string;
  type: string;
  conversationTime: string | null;
}

interface SentimentMonth {
  month: string;
  total_mentions: number;
  positive_count: number;
  warning_count: number;
  positive_percent: number;
  promoter_count: number;
  passive_count: number;
  detractor_count: number;
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseMonthLabel(yyyyMm: string): string {
  const monthIndex = parseInt(yyyyMm.split("-")[1], 10) - 1;
  return MONTH_LABELS[monthIndex] ?? yyyyMm;
}

function formatRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function TypeBadge({ type }: { type: string }) {
  if (type === "positive") {
    return (
      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100 transition-colors">
        positive
      </Badge>
    );
  }

  return (
    <Badge className="bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100 transition-colors">
      concern
    </Badge>
  );
}

export function DashboardOverview({ vendorName, onNavigate }: DashboardOverviewProps): JSX.Element {
  const supabase = useClerkSupabase();

  const { data: mentions } = useQuery({
    queryKey: ["vendor-recent-mentions", vendorName],
    queryFn: async () => {
      const result = await fetchVendorPulseFeed({ vendorName, pageSize: 10 });
      return result.mentions.map((m) => ({
        id: String(m.id),
        quote: m.quote ?? "",
        type: m.type,
        conversationTime: m.conversationTime ?? null,
      })) as VendorMention[];
    },
  });

  const { data: sentimentHistory = [] } = useQuery({
    queryKey: ["vendor-sentiment-history", vendorName],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_vendor_sentiment_history" as never,
        { p_vendor_name: vendorName } as never
      );
      if (error) throw error;
      return (data || []) as SentimentMonth[];
    },
  });

  const latestSentiment = sentimentHistory?.[sentimentHistory.length - 1] ?? null;

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Overview</h1>
          <p className="text-slate-500 mt-1 font-medium">Daily pulse and performance snapshots</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="bg-white" onClick={() => onNavigate("intelligence")}>
            Full Analysis
          </Button>
          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm" onClick={() => onNavigate("mentions")}>
            Manage Mentions
          </Button>
        </div>
      </div>

      {/* Pulse Briefing — health, quotes, signals, competitive, top actions */}
      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl blur opacity-5 group-hover:opacity-10 transition duration-1000 group-hover:duration-200"></div>
        <div className="relative">
          <PulseBriefing vendorName={vendorName} onNavigate={onNavigate} />
        </div>
      </div>

      {/* Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Charts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Sentiment over time chart */}
          {sentimentHistory.length >= 2 && (() => {
            const chartData = sentimentHistory.map((m) => ({
              month: parseMonthLabel(m.month),
              positive: m.positive_percent ?? 0,
              total: m.total_mentions,
              positiveCount: m.positive_count,
              warningCount: m.warning_count,
            }));

            return (
              <div className="space-y-6">
                <Card className="border-slate-200 shadow-sm overflow-hidden group hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2 bg-slate-50/50 border-b border-slate-100">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                        Sentiment Trend
                      </CardTitle>
                      <Badge variant="outline" className="text-[10px] font-bold tracking-widest uppercase">Last {sentimentHistory.length} Months</Badge>
                    </div>
                    <CardDescription className="text-xs font-medium">Monthly positive sentiment percentage</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <ResponsiveContainer width="100%" height={240}>
                      <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="sentimentGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.01} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 500 }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 500 }} axisLine={false} tickLine={false} unit="%" />
                        <Tooltip
                          contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12, boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                          formatter={(value: number) => [`${value}%`, "Positive"]}
                        />
                        <Area
                          type="monotone"
                          dataKey="positive"
                          stroke="#10b981"
                          strokeWidth={3}
                          fill="url(#sentimentGrad)"
                          dot={{ r: 4, fill: "#10b981", strokeWidth: 2, stroke: "#fff" }}
                          activeDot={{ r: 6, strokeWidth: 0 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm overflow-hidden group hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2 bg-slate-50/50 border-b border-slate-100">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <BarChart2 className="h-4 w-4 text-indigo-500" />
                        Mention Volume
                      </CardTitle>
                      <div className="flex gap-4 text-[10px] font-bold uppercase tracking-wider">
                        <span className="flex items-center gap-1.5 text-emerald-600">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" /> Positive
                        </span>
                        <span className="flex items-center gap-1.5 text-amber-600">
                          <span className="h-2 w-2 rounded-full bg-amber-500" /> Concerns
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 500 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 500 }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip
                          cursor={{ fill: '#f8fafc' }}
                          contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12, boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                          formatter={(value: number, name: string) => [value, name === "positiveCount" ? "Positive" : "Concerns"]}
                        />
                        <Bar dataKey="positiveCount" stackId="mentions" fill="#10b981" radius={[0, 0, 0, 0]} name="Positive" barSize={32} />
                        <Bar dataKey="warningCount" stackId="mentions" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Concerns" barSize={32} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            );
          })()}
        </div>

        {/* Right: NPS & Activity */}
        <div className="lg:col-span-1 space-y-8">
          <NPSChart 
            promoterCount={latestSentiment?.promoter_count ?? 0}
            passiveCount={latestSentiment?.passive_count ?? 0}
            detractorCount={latestSentiment?.detractor_count ?? 0}
          />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-indigo-500" />
                Recent Activity Feed
              </h2>
              <Button variant="ghost" size="sm" className="text-xs font-bold text-indigo-600 hover:text-indigo-700 p-0 h-auto" onClick={() => onNavigate("mentions")}>
                View All <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>

            {!mentions || mentions.length === 0 ? (
              <Card className="border-dashed border-2 bg-slate-50/50">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-4 text-slate-400">
                    <MessageSquare className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-medium text-slate-500">No recent mentions recorded.</p>
                  <p className="text-xs text-slate-400 mt-1">Activity will appear as users interact with your brand.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {mentions.slice(0, 6).map((mention) => (
                  <div 
                    key={mention.id} 
                    className="group flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all duration-200"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <TypeBadge type={mention.type} />
                      <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        <Clock className="h-3 w-3" />
                        {mention.conversationTime ? formatRelativeTime(mention.conversationTime) : "recent"}
                      </span>
                    </div>
                    <p className="text-[13px] leading-relaxed text-slate-600 italic">
                      "{mention.quote}"
                    </p>
                  </div>
                ))}
                
                <Button 
                  variant="outline" 
                  className="w-full border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors text-xs font-bold py-6 rounded-xl border-dashed"
                  onClick={() => onNavigate("mentions")}
                >
                  Load More Activity
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
