import { useMemo } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  useLatestHeartbeats,
  useLifecycleEvents,
  useGroupHealth,
  useIngestionGaps,
  type HeartbeatRow,
  type GroupHealthRow,
} from "@/hooks/useSystemHealth";

function formatAgo(iso: string | null | undefined): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "unknown";
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

function ageMs(iso: string | null | undefined): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const ms = Date.now() - new Date(iso).getTime();
  return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
}

function statusColor(state: string, ageSec: number): string {
  if (ageSec > 300) return "text-rose-400";       // >5min: stale heartbeat
  if (state === "READY" || state === "CONNECTED") return "text-emerald-400";
  if (state === "AWAITING_QR" || state === "PAIRING") return "text-amber-400";
  return "text-zinc-400";
}

// ── Live status card per client ──
function LiveStatusCard({ hb }: { hb: HeartbeatRow }) {
  const ageMsVal = ageMs(hb.recorded_at);
  const ageSec = Math.floor(ageMsVal / 1000);
  const stale = ageSec > 300;
  const Icon = stale ? WifiOff : Wifi;
  const color = statusColor(hb.client_state, ageSec);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex items-center gap-3 mb-3">
        <Icon className={`h-5 w-5 ${color}`} />
        <div className="font-medium text-zinc-100">{hb.client_name}</div>
        {stale && (
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-900">
            STALE
          </span>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-y-2 text-xs text-zinc-400">
        <dt>State</dt>
        <dd className={`font-mono ${color}`}>{hb.client_state}</dd>
        <dt>Last heartbeat</dt>
        <dd className="text-zinc-200">{formatAgo(hb.recorded_at)}</dd>
        <dt>Phone</dt>
        <dd className="text-zinc-200">{hb.phone_number || "—"}</dd>
        <dt>Groups visible</dt>
        <dd className="text-zinc-200">
          {hb.groups_total ?? "—"} / monitored {hb.groups_monitored ?? "—"}
        </dd>
      </dl>
    </div>
  );
}

// ── Group health table ──
function GroupHealthTable({ rows }: { rows: GroupHealthRow[] }) {
  const counts = useMemo(() => {
    const c = { active: 0, quiet: 0, silent: 0 };
    for (const r of rows) c[r.status] += 1;
    return c;
  }, [rows]);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="text-sm font-medium text-zinc-200">Per-group health</div>
        <div className="flex gap-3 text-xs">
          <span className="text-emerald-400">● {counts.active} active</span>
          <span className="text-amber-400">● {counts.quiet} quiet</span>
          <span className="text-rose-400">● {counts.silent} silent</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-zinc-500">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Group</th>
              <th className="text-left px-4 py-2 font-medium">Status</th>
              <th className="text-right px-4 py-2 font-medium">24h</th>
              <th className="text-right px-4 py-2 font-medium">7d</th>
              <th className="text-right px-4 py-2 font-medium">30d</th>
              <th className="text-left px-4 py-2 font-medium">Last message</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const dot =
                r.status === "active"
                  ? "text-emerald-400"
                  : r.status === "quiet"
                    ? "text-amber-400"
                    : "text-rose-400";
              return (
                <tr key={r.id} className="border-t border-zinc-900">
                  <td className="px-4 py-2 text-zinc-200">{r.name}</td>
                  <td className="px-4 py-2">
                    <span className={`${dot} font-mono`}>● {r.status}</span>
                  </td>
                  <td className="px-4 py-2 text-right text-zinc-300">
                    {r.msgs_last_24h}
                  </td>
                  <td className="px-4 py-2 text-right text-zinc-300">
                    {r.msgs_last_7d}
                  </td>
                  <td className="px-4 py-2 text-right text-zinc-400">
                    {r.msgs_last_30d}
                  </td>
                  <td className="px-4 py-2 text-zinc-400">
                    {formatAgo(r.last_message_at)}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  No monitored groups.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Outage timeline ──
function OutageTimeline() {
  const gaps = useIngestionGaps();
  const events = useLifecycleEvents(50);
  const loading = gaps.isLoading || events.isLoading;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="rounded-xl border border-zinc-800 bg-zinc-950">
        <div className="px-4 py-3 border-b border-zinc-800 text-sm font-medium text-zinc-200">
          Ingestion gaps (&gt;6h, last 30 days)
        </div>
        <div className="px-4 py-3 max-h-80 overflow-y-auto">
          {loading && (
            <div className="text-xs text-zinc-500">
              <Loader2 className="inline h-3 w-3 mr-1 animate-spin" /> Loading…
            </div>
          )}
          {!loading && (gaps.data?.length ?? 0) === 0 && (
            <div className="text-xs text-zinc-500 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              No long ingestion gaps in the last 30 days.
            </div>
          )}
          <ul className="space-y-2 text-xs">
            {(gaps.data || []).map((g, i) => (
              <li key={i} className="flex items-start gap-2">
                <AlertCircle className="h-3.5 w-3.5 text-rose-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-zinc-200">{g.hours.toFixed(1)} hours</div>
                  <div className="text-zinc-500">
                    {new Date(g.start).toLocaleString()} →{" "}
                    {new Date(g.end).toLocaleString()}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950">
        <div className="px-4 py-3 border-b border-zinc-800 text-sm font-medium text-zinc-200">
          Recent lifecycle events
        </div>
        <div className="px-4 py-3 max-h-80 overflow-y-auto">
          {loading && (
            <div className="text-xs text-zinc-500">
              <Loader2 className="inline h-3 w-3 mr-1 animate-spin" /> Loading…
            </div>
          )}
          {!loading && (events.data?.length ?? 0) === 0 && (
            <div className="text-xs text-zinc-500">
              No lifecycle events recorded yet.
            </div>
          )}
          <ul className="space-y-2 text-xs">
            {(events.data || []).map((e) => (
              <li key={e.id} className="flex items-start gap-2">
                <Clock className="h-3.5 w-3.5 text-zinc-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-zinc-200">
                    <span className="font-mono text-zinc-400">
                      {e.client_name}
                    </span>{" "}
                    {e.event_type}
                    {e.from_state && e.to_state && (
                      <>
                        : <span className="font-mono">{e.from_state}</span> →{" "}
                        <span className="font-mono">{e.to_state}</span>
                      </>
                    )}
                  </div>
                  <div className="text-zinc-500">
                    {new Date(e.occurred_at).toLocaleString()}
                    {e.reason ? ` — ${e.reason}` : ""}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──
const SystemHealthPage = () => {
  const heartbeats = useLatestHeartbeats();
  const groups = useGroupHealth();

  const noClients =
    !heartbeats.isLoading && (heartbeats.data?.length ?? 0) === 0;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Activity className="h-5 w-5 text-zinc-400" />
        <h1 className="text-xl font-semibold text-zinc-100">System Health</h1>
      </div>

      {noClients && (
        <div className="rounded-xl border border-amber-900 bg-amber-950/30 p-4 text-amber-200 text-sm">
          No heartbeat rows yet. The cdg-wam service hasn't registered with the
          health monitor — once the next deploy lands, heartbeats will appear
          here every ~60 seconds.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(heartbeats.data || []).map((hb) => (
          <LiveStatusCard key={hb.client_name} hb={hb} />
        ))}
      </div>

      {groups.isLoading ? (
        <div className="text-sm text-zinc-500">
          <Loader2 className="inline h-3 w-3 mr-1 animate-spin" /> Loading group
          health…
        </div>
      ) : (
        <GroupHealthTable rows={groups.data || []} />
      )}

      <OutageTimeline />
    </div>
  );
};

export default SystemHealthPage;
