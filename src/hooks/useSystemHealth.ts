import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const wam = () => supabase.schema("wam" as any);

export interface HeartbeatRow {
  id: number;
  recorded_at: string;
  client_name: string;
  client_state: string;
  groups_total: number | null;
  groups_monitored: number | null;
  phone_number: string | null;
  metadata: Record<string, unknown> | null;
}

export interface LifecycleEventRow {
  id: number;
  occurred_at: string;
  client_name: string;
  event_type: string;
  from_state: string | null;
  to_state: string | null;
  reason: string | null;
}

export interface GroupHealthRow {
  id: number;
  name: string;
  is_monitored: number;
  last_message_at: string | null;
  msgs_last_24h: number;
  msgs_last_7d: number;
  msgs_last_30d: number;
  status: "active" | "quiet" | "silent";
}

const REFETCH_MS = 30_000;

/** Latest heartbeat per client_name. Absence of recent rows = ingestion is dead. */
export function useLatestHeartbeats() {
  return useQuery({
    queryKey: ["system-health", "latest-heartbeats"],
    refetchInterval: REFETCH_MS,
    queryFn: async () => {
      // Pull the last 50; we'll dedupe to latest-per-client client-side. Cheap.
      const { data, error } = await wam()
        .from("ingest_heartbeat")
        .select("*")
        .order("recorded_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const rows = (data || []) as HeartbeatRow[];
      const byClient = new Map<string, HeartbeatRow>();
      for (const row of rows) {
        if (!byClient.has(row.client_name)) byClient.set(row.client_name, row);
      }
      return Array.from(byClient.values());
    },
  });
}

/** Recent lifecycle events (state changes / disconnects / auth failures). */
export function useLifecycleEvents(limit = 50) {
  return useQuery({
    queryKey: ["system-health", "lifecycle-events", limit],
    refetchInterval: REFETCH_MS,
    queryFn: async () => {
      const { data, error } = await wam()
        .from("client_lifecycle_events")
        .select("*")
        .order("occurred_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as LifecycleEventRow[];
    },
  });
}

/**
 * Per-group health for monitored groups. Joins wam.groups with wam.messages
 * to compute last_message_at and recent volume counts. Status:
 *   active = msg in last 24h
 *   quiet  = msg in last 7d but not last 24h
 *   silent = no msg in last 7d
 */
export function useGroupHealth() {
  return useQuery({
    queryKey: ["system-health", "group-health"],
    refetchInterval: REFETCH_MS,
    queryFn: async () => {
      const { data: groups, error: groupsErr } = await wam()
        .from("groups")
        .select("id, name, is_monitored")
        .eq("is_monitored", 1);
      if (groupsErr) throw groupsErr;

      // Pull recent messages once and aggregate client-side.
      // We only fetch the last 30d; older rows aren't relevant for the
      // status badge or recent-volume columns.
      const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const { data: msgs, error: msgsErr } = await wam()
        .from("messages")
        .select("group_id, timestamp")
        .gte("timestamp", since);
      if (msgsErr) throw msgsErr;

      const now = Date.now();
      const day = 24 * 3600 * 1000;
      const byGroup = new Map<
        number,
        { last: string | null; m24: number; m7: number; m30: number }
      >();
      for (const m of msgs || []) {
        const ts = new Date(m.timestamp).getTime();
        if (Number.isNaN(ts)) continue;
        const age = now - ts;
        const cur =
          byGroup.get(m.group_id) || { last: null, m24: 0, m7: 0, m30: 0 };
        cur.m30 += 1;
        if (age <= 7 * day) cur.m7 += 1;
        if (age <= 1 * day) cur.m24 += 1;
        if (!cur.last || new Date(cur.last).getTime() < ts) cur.last = m.timestamp;
        byGroup.set(m.group_id, cur);
      }

      const rows: GroupHealthRow[] = (groups || []).map((g: any) => {
        const stats = byGroup.get(g.id) || { last: null, m24: 0, m7: 0, m30: 0 };
        let status: GroupHealthRow["status"] = "silent";
        if (stats.m24 > 0) status = "active";
        else if (stats.m7 > 0) status = "quiet";
        return {
          id: g.id,
          name: g.name,
          is_monitored: g.is_monitored,
          last_message_at: stats.last,
          msgs_last_24h: stats.m24,
          msgs_last_7d: stats.m7,
          msgs_last_30d: stats.m30,
          status,
        };
      });

      rows.sort((a, b) => {
        const order = { silent: 0, quiet: 1, active: 2 } as const;
        const cmp = order[a.status] - order[b.status];
        if (cmp !== 0) return cmp;
        return b.msgs_last_30d - a.msgs_last_30d;
      });

      return rows;
    },
  });
}

/**
 * Detect ingestion gaps (windows with zero message inserts longer than 6h)
 * over the last 30 days. Tells the operator when ingestion was likely down.
 */
export function useIngestionGaps() {
  return useQuery({
    queryKey: ["system-health", "ingestion-gaps"],
    refetchInterval: REFETCH_MS * 2, // gaps don't move that fast
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const { data, error } = await wam()
        .from("messages")
        .select("created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const gaps: { start: string; end: string; hours: number }[] = [];
      let prev: number | null = null;
      for (const m of data || []) {
        const t = new Date(m.created_at).getTime();
        if (Number.isNaN(t)) continue;
        if (prev !== null && t - prev > 6 * 3600 * 1000) {
          gaps.push({
            start: new Date(prev).toISOString(),
            end: new Date(t).toISOString(),
            hours: (t - prev) / 3_600_000,
          });
        }
        prev = t;
      }
      gaps.sort((a, b) => b.hours - a.hours);
      return gaps.slice(0, 20);
    },
  });
}
