import { useState, useEffect, useMemo } from "react";
import { Users, Activity, MessageSquare, TrendingUp, Search, ArrowUpDown, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useWamApi } from "@/hooks/useWamApi";
import type { Member, MemberActivity } from "@/types/admin";

const TIME_RANGES = [
  { label: "7 days", value: 7 },
  { label: "14 days", value: 14 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
  { label: "365 days", value: 365 },
];

const SORT_OPTIONS = [
  { label: "Most Active", value: "most_active" },
  { label: "Least Active", value: "least_active" },
  { label: "Most Groups", value: "most_groups" },
  { label: "Name A-Z", value: "name_asc" },
  { label: "Recent Activity", value: "recent" },
];

// Activity heatmap component
const ActivitySquares = ({ activity, days }: { activity: MemberActivity[]; days: number }) => {
  const activityMap = useMemo(() => {
    const map = new Map<string, number>();
    activity.forEach((a) => map.set(a.date, a.count));
    return map;
  }, [activity]);

  const allCounts = activity.map((a) => a.count).filter((c) => c > 0).sort((a, b) => a - b);
  const p25 = allCounts[Math.floor(allCounts.length * 0.25)] || 1;
  const p50 = allCounts[Math.floor(allCounts.length * 0.5)] || 2;
  const p75 = allCounts[Math.floor(allCounts.length * 0.75)] || 5;

  const getColor = (count: number) => {
    if (count === 0) return "bg-red-900/40";
    if (count <= p25) return "bg-green-900/50";
    if (count <= p50) return "bg-green-700/60";
    if (count <= p75) return "bg-green-600/70";
    return "bg-green-500";
  };

  const dates: string[] = [];
  for (let i = Math.min(days, 28) - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split("T")[0]);
  }

  return (
    <div className="flex gap-0.5">
      {dates.map((date) => {
        const count = activityMap.get(date) || 0;
        return (
          <div
            key={date}
            title={`${date}: ${count} messages`}
            className={`w-2.5 h-2.5 rounded-sm ${getColor(count)}`}
          />
        );
      })}
    </div>
  );
};

const MembersPage = () => {
  const wam = useWamApi();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("most_active");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  useEffect(() => {
    setLoading(true);
    wam
      .getMembersWithActivity(days)
      .then((res: any) => setMembers(res.members || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days]);

  const filtered = useMemo(() => {
    let list = members;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          m.sender.toLowerCase().includes(q) ||
          (m.sender_number && m.sender_number.includes(q))
      );
    }
    list = [...list].sort((a, b) => {
      switch (sort) {
        case "most_active": return b.totalMessageCount - a.totalMessageCount;
        case "least_active": return a.totalMessageCount - b.totalMessageCount;
        case "most_groups": return b.groupCount - a.groupCount;
        case "name_asc": return a.sender.localeCompare(b.sender);
        case "recent":
          return new Date(b.lastMessageTime || 0).getTime() - new Date(a.lastMessageTime || 0).getTime();
        default: return 0;
      }
    });
    return list;
  }, [members, search, sort]);

  const activeMembers = members.filter((m) => m.totalMessageCount > 0);
  const totalMessages = members.reduce((s, m) => s + m.totalMessageCount, 0);
  const avgPerActive = activeMembers.length > 0 ? Math.round(totalMessages / activeMembers.length) : 0;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold text-zinc-100">Members</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-blue-400 mb-2">
            <Users className="h-4 w-4" />
            <span className="text-xs font-medium">Total Members</span>
          </div>
          <div className="text-2xl font-bold text-zinc-100">{members.length}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-400 mb-2">
            <Activity className="h-4 w-4" />
            <span className="text-xs font-medium">Active Members</span>
          </div>
          <div className="text-2xl font-bold text-zinc-100">{activeMembers.length}</div>
          <div className="text-xs text-zinc-500 mt-1">
            {members.length > 0 ? Math.round((activeMembers.length / members.length) * 100) : 0}% active
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-purple-400 mb-2">
            <MessageSquare className="h-4 w-4" />
            <span className="text-xs font-medium">Total Messages</span>
          </div>
          <div className="text-2xl font-bold text-zinc-100">{totalMessages.toLocaleString()}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-amber-400 mb-2">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs font-medium">Avg / Active</span>
          </div>
          <div className="text-2xl font-bold text-zinc-100">{avgPerActive}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
          <Input
            placeholder="Search members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 bg-zinc-900 border-zinc-700 text-zinc-200 text-sm"
          />
        </div>
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="w-32 bg-zinc-900 border-zinc-700 text-zinc-300 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700">
            {TIME_RANGES.map((r) => (
              <SelectItem key={r.value} value={String(r.value)} className="text-zinc-300">
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-40 bg-zinc-900 border-zinc-700 text-zinc-300 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700">
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-zinc-300">
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : (
        <div className="border border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900">
              <tr className="text-zinc-400 text-xs">
                <th className="p-3 text-left">Member</th>
                <th className="p-3 text-center">Groups</th>
                <th className="p-3 text-center">Messages</th>
                <th className="p-3 text-right">Last Active</th>
                <th className="p-3 text-right">Activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filtered.map((m) => (
                <tr key={m.sender} className="hover:bg-zinc-900/50">
                  <td className="p-3">
                    <div className="text-zinc-200 font-medium">{m.sender}</div>
                    {m.sender_number && (
                      <div className="text-xs text-zinc-500">{m.sender_number}</div>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => setSelectedMember(m)}
                      className="text-blue-400 hover:text-blue-300 text-sm"
                    >
                      {m.groupCount}
                    </button>
                  </td>
                  <td className="p-3 text-center text-zinc-300">{m.totalMessageCount}</td>
                  <td className="p-3 text-right text-xs text-zinc-400">
                    {m.lastMessageTime
                      ? new Date(m.lastMessageTime).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="p-3 text-right">
                    <ActivitySquares activity={m.dailyActivity || []} days={days} />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-zinc-500">
                    No members found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Member Groups Modal */}
      <Dialog open={!!selectedMember} onOpenChange={() => setSelectedMember(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">
              Groups for {selectedMember?.sender}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {selectedMember?.groups?.map((g) => (
              <div key={g.id} className="flex items-center justify-between p-2 bg-zinc-800 rounded text-sm">
                <div>
                  <div className="text-zinc-200">{g.name}</div>
                  {g.isMonitored && (
                    <span className="text-[10px] text-green-400">Monitored</span>
                  )}
                </div>
                <div className="text-zinc-400 text-xs">{g.messageCount} msgs</div>
              </div>
            )) || (
              <div className="text-zinc-500 text-sm text-center py-4">No group data</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MembersPage;
