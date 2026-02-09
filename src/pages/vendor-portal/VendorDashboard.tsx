import { useState, useEffect, useMemo } from "react";
import { useVendorAuth } from "@/hooks/useVendorAuth";
import { createVendorPortalApi, VendorMention, VendorStats } from "@/lib/vendorPortalApi";
import { Link } from "react-router-dom";
import {
  TrendingUp,
  TrendingDown,
  MessageSquare,
  Loader2,
  ArrowRight,
} from "lucide-react";

export default function VendorDashboard() {
  const { getToken, getOrgId, organization, vendorNames, isLoaded } = useVendorAuth();
  const api = useMemo(() => createVendorPortalApi(getToken, getOrgId), [getToken, getOrgId]);

  const [stats, setStats] = useState<VendorStats | null>(null);
  const [recentMentions, setRecentMentions] = useState<VendorMention[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Wait for organization to be loaded before making API calls
    if (!isLoaded || !organization) return;
    
    async function load() {
      try {
        const [statsData, mentionsData] = await Promise.all([
          api.getStats(),
          api.getMentions({ limit: 5 }),
        ]);
        setStats(statsData);
        setRecentMentions(mentionsData.mentions);
      } catch (error) {
        console.error("Failed to load dashboard:", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [api, isLoaded, organization]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Welcome back, {organization?.name}. Tracking: {vendorNames.join(", ") || "No vendors assigned"}.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Total Mentions"
          value={stats?.total ?? 0}
          icon={MessageSquare}
          color="text-blue-400"
          bgColor="bg-blue-900/20"
        />
        <StatCard
          label="Positive"
          value={stats?.positive ?? 0}
          icon={TrendingUp}
          color="text-green-400"
          bgColor="bg-green-900/20"
        />
        <StatCard
          label="Negative"
          value={stats?.negative ?? 0}
          icon={TrendingDown}
          color="text-red-400"
          bgColor="bg-red-900/20"
        />
      </div>

      {/* Recent Mentions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Mentions</h2>
          <Link
            to="/vendor-portal/reviews"
            className="text-sm text-[#FFD700] hover:text-yellow-400 flex items-center gap-1"
          >
            Open inbox <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {recentMentions.length === 0 ? (
          <div className="text-center py-12 text-zinc-500">
            <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No mentions found yet</p>
            <p className="text-xs mt-1">
              Mentions will appear here as dealers discuss your brand.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentMentions.map((mention) => (
              <div
                key={mention.id}
                className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/50 hover:bg-zinc-900 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-2 h-2 mt-2 rounded-full flex-shrink-0 ${
                      mention.type === "positive" ? "bg-green-500" : "bg-red-500"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-white">{mention.title}</span>
                      <span className="text-xs text-zinc-500 px-2 py-0.5 rounded-full bg-zinc-800">
                        {mention.category}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-400 line-clamp-2">{mention.quote}</p>
                    <span className="text-xs text-zinc-600 mt-1 block">
                      {new Date(mention.conversation_time).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  bgColor,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}) {
  return (
    <div className="border border-zinc-800 rounded-xl p-5 bg-zinc-900/50">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${bgColor} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-xs text-zinc-500">{label}</div>
        </div>
      </div>
    </div>
  );
}
