import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ListChecks,
  MessageSquare,
  Radio,
  CalendarClock,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Loader2,
} from "lucide-react";

interface DashboardStats {
  queuePending: number;
  queueProcessed: number;
  queueFailed: number;
  topicsActive: number;
  topicsRejected: number;
  topicsPinned: number;
  groupsTotal: number;
  groupsMonitored: number;
  tasksActive: number;
  occurrencesPending: number;
  approvedMentions: number;
}

const StatCard = ({
  label,
  value,
  icon: Icon,
  color = "text-zinc-100",
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color?: string;
}) => (
  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
    <div className="flex items-center gap-3 mb-2">
      <Icon className={`h-4 w-4 ${color}`} />
      <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
        {label}
      </span>
    </div>
    <p className={`text-2xl font-bold ${color}`}>{value}</p>
  </div>
);

const AdminDashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [queue, topics, groups, tasks, occurrences, mentions] =
          await Promise.all([
            supabase
              .schema("wam" as any)
              .from("vendor_processing_queue")
              .select("status", { count: "exact", head: false }),
            supabase.schema("wam" as any).from("topics").select("status, is_pinned"),
            supabase
              .schema("wam" as any)
              .from("groups")
              .select("is_monitored"),
            supabase
              .schema("wam" as any)
              .from("task_definitions")
              .select("is_archived"),
            supabase
              .schema("wam" as any)
              .from("task_occurrences")
              .select("status"),
            supabase.from("vendor_mentions").select("id", { count: "exact", head: true }),
          ]);

        const queueData = queue.data || [];
        const topicData = topics.data || [];
        const groupData = groups.data || [];
        const taskData = tasks.data || [];
        const occData = occurrences.data || [];

        setStats({
          queuePending: queueData.filter((r: any) => r.status === "pending").length,
          queueProcessed: queueData.filter((r: any) => r.status === "processed").length,
          queueFailed: queueData.filter((r: any) => r.status === "failed").length,
          topicsActive: topicData.filter((r: any) => r.status === "active").length,
          topicsRejected: topicData.filter((r: any) => r.status === "rejected").length,
          topicsPinned: topicData.filter((r: any) => r.is_pinned).length,
          groupsTotal: groupData.length,
          groupsMonitored: groupData.filter((r: any) => r.is_monitored).length,
          tasksActive: taskData.filter((r: any) => !r.is_archived).length,
          occurrencesPending: occData.filter((r: any) => r.status === "pending").length,
          approvedMentions: mentions.count || 0,
        });
      } catch (err) {
        console.error("Failed to fetch dashboard stats:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-20 text-zinc-500">
        Failed to load dashboard stats.
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-zinc-100">Dashboard</h1>
        <p className="text-sm text-zinc-500 mt-1">System overview</p>
      </div>

      {/* Vendor Queue */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <ListChecks className="h-4 w-4" /> Vendor Queue
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Pending" value={stats.queuePending} icon={Clock} color="text-amber-400" />
          <StatCard label="Processed" value={stats.queueProcessed} icon={CheckCircle2} color="text-green-400" />
          <StatCard label="Failed" value={stats.queueFailed} icon={AlertTriangle} color="text-red-400" />
          <StatCard label="Approved Mentions" value={stats.approvedMentions} icon={CheckCircle2} color="text-blue-400" />
        </div>
      </section>

      {/* Topics */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <MessageSquare className="h-4 w-4" /> Topics
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatCard label="Active" value={stats.topicsActive} icon={MessageSquare} color="text-green-400" />
          <StatCard label="Rejected" value={stats.topicsRejected} icon={AlertTriangle} color="text-red-400" />
          <StatCard label="Pinned" value={stats.topicsPinned} icon={CheckCircle2} color="text-amber-400" />
        </div>
      </section>

      {/* Groups */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Radio className="h-4 w-4" /> Groups
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Total" value={stats.groupsTotal} icon={Radio} />
          <StatCard label="Monitored" value={stats.groupsMonitored} icon={CheckCircle2} color="text-green-400" />
        </div>
      </section>

      {/* Tasks */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <CalendarClock className="h-4 w-4" /> Tasks
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Active Definitions" value={stats.tasksActive} icon={CalendarClock} />
          <StatCard label="Pending Occurrences" value={stats.occurrencesPending} icon={Clock} color="text-amber-400" />
        </div>
      </section>
    </div>
  );
};

export default AdminDashboard;
