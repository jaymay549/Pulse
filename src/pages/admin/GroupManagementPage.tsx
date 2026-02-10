import { useMemo, useState } from "react";
import { Loader2, Search, MessageSquare, Users, BarChart3, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GroupTable from "@/components/admin/groups/GroupTable";
import GroupDetailSheet from "@/components/admin/groups/GroupDetailSheet";
import {
  useAdminGroups,
  useToggleGroupMonitoring,
  useToggleGroupFavorite,
  useGroupKpis,
} from "@/hooks/useAdminGroups";
import { toast } from "sonner";
import type { WhatsAppGroup } from "@/types/admin";

const GroupManagementPage = () => {
  const { data: groups, isLoading } = useAdminGroups();
  const toggleMonitoring = useToggleGroupMonitoring();
  const toggleFavorite = useToggleGroupFavorite();
  const kpis = useGroupKpis(groups);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const [selectedGroup, setSelectedGroup] = useState<WhatsAppGroup | null>(null);

  const filtered = useMemo(() => {
    if (!groups) return [];
    let list = groups;
    if (tab === "monitored") list = list.filter((g) => g.is_monitored);
    if (tab === "favorites") list = list.filter((g) => g.is_favorite);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((g) => g.name.toLowerCase().includes(q));
    }
    return list;
  }, [groups, tab, search]);

  const handleToggleMonitoring = async (id: number, monitored: boolean) => {
    try {
      await toggleMonitoring.mutateAsync({ id, monitored });
      toast.success(monitored ? "Monitoring enabled" : "Monitoring disabled");
    } catch (err: any) {
      toast.error(err?.message || "Failed to toggle monitoring");
    }
  };

  const handleToggleFavorite = async (id: number, favorite: boolean) => {
    try {
      await toggleFavorite.mutateAsync({ id, favorite });
    } catch (err: any) {
      toast.error(err?.message || "Failed to toggle favorite");
    }
  };

  const kpiCards = [
    {
      label: "Messages (7d)",
      value: kpis.totalMessages7d.toLocaleString(),
      sub: `Median: ${kpis.medianMessages7d}`,
      icon: MessageSquare,
      color: "text-blue-400",
    },
    {
      label: "Active Groups (7d)",
      value: kpis.activeSenders7d.toLocaleString(),
      sub: `of ${groups?.length || 0} total`,
      icon: Users,
      color: "text-green-400",
    },
    {
      label: "Avg Messages/Group",
      value: kpis.avgMessagesPerSender.toLocaleString(),
      sub: "per active group",
      icon: BarChart3,
      color: "text-purple-400",
    },
    {
      label: "Monitored",
      value: (groups?.filter((g) => g.is_monitored).length || 0).toLocaleString(),
      sub: `of ${groups?.length || 0} groups`,
      icon: TrendingUp,
      color: "text-amber-400",
    },
  ];

  return (
    <div className="space-y-4 max-w-6xl">
      <div>
        <h1 className="text-xl font-bold text-zinc-100">Group Management</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Manage WhatsApp groups, monitoring, and custom views.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpiCards.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-zinc-900/60 border border-zinc-800 rounded-xl px-4 py-3"
          >
            <div className="flex items-center gap-2 mb-1">
              <kpi.icon className={`h-3.5 w-3.5 ${kpi.color}`} />
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{kpi.label}</span>
            </div>
            <p className="text-lg font-bold text-zinc-100">{kpi.value}</p>
            <p className="text-[10px] text-zinc-600">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search groups..."
          className="h-8 pl-8 text-xs bg-zinc-900 border-zinc-700 text-zinc-300"
        />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <div className="flex items-center justify-between">
          <TabsList className="bg-zinc-900 border border-zinc-800">
            <TabsTrigger
              value="all"
              className="text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 text-zinc-500"
            >
              All ({groups?.length || 0})
            </TabsTrigger>
            <TabsTrigger
              value="monitored"
              className="text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 text-zinc-500"
            >
              Monitored ({groups?.filter((g) => g.is_monitored).length || 0})
            </TabsTrigger>
            <TabsTrigger
              value="favorites"
              className="text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 text-zinc-500"
            >
              Favorites ({groups?.filter((g) => g.is_favorite).length || 0})
            </TabsTrigger>
          </TabsList>
          <span className="text-xs text-zinc-500">{filtered.length} groups</span>
        </div>

        <TabsContent value={tab}>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-zinc-500 text-center py-8">No groups found.</p>
          ) : (
            <GroupTable
              groups={filtered}
              onToggleMonitoring={handleToggleMonitoring}
              onToggleFavorite={handleToggleFavorite}
              onSelectGroup={setSelectedGroup}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Detail sheet */}
      {selectedGroup && (
        <GroupDetailSheet
          group={selectedGroup}
          onClose={() => setSelectedGroup(null)}
        />
      )}
    </div>
  );
};

export default GroupManagementPage;
