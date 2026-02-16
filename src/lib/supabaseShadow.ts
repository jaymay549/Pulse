import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

// Rate limit: one log per endpoint per 5 min
const lastLogged = new Map<string, number>();
const RATE_MS = 5 * 60_000;

/**
 * Fire-and-forget shadow compare. Fetches from Supabase, compares with WAM
 * response, logs mismatches. Never throws.
 */
export async function shadowCompare(
  endpoint: string,
  wamData: unknown,
  query: () => Promise<unknown>,
) {
  if (!supabase) return;
  const now = Date.now();
  if (now - (lastLogged.get(endpoint) ?? 0) < RATE_MS) return;

  try {
    const sbData = await query();
    const diff = detectDiff(endpoint, wamData, sbData);
    if (diff) {
      lastLogged.set(endpoint, now);
      supabase
        .from("shadow_read_logs")
        .insert({ endpoint, diff })
        .then(() => {});
    }
  } catch {
    // silent
  }
}

function detectDiff(
  endpoint: string,
  wam: any,
  sb: any,
): string | null {
  if (endpoint.includes("/mentions")) {
    const wc = wam?.totalCount ?? 0;
    const sc = sb?.length ?? 0;
    if (wc !== sc) return `count WAM=${wc} SB=${sc}`;
  } else if (endpoint.includes("/profile")) {
    const ws = wam?.stats;
    const ss = sb?.stats;
    if (ws?.totalMentions !== ss?.totalMentions)
      return `total WAM=${ws?.totalMentions} SB=${ss?.totalMentions}`;
  } else if (endpoint.includes("/vendors-list")) {
    const wc = wam?.vendors?.length ?? 0;
    const sc = sb?.length ?? 0;
    if (wc !== sc) return `vendors WAM=${wc} SB=${sc}`;
  }
  return null;
}

// ── Query builders ──────────────────────────────────────────

export function buildMentionsQuery(f: {
  category?: string;
  vendorName?: string;
  type?: string;
  page?: number;
  pageSize?: number;
}) {
  return async () => {
    if (!supabase) return [];
    let q = supabase.from("vendor_mentions").select("*", { count: "exact" });
    if (f.category) q = q.eq("category", f.category);
    if (f.vendorName) q = q.eq("vendor_name", f.vendorName);
    if (f.type) q = q.eq("type", f.type);
    q = q.order("conversation_time", { ascending: false });
    const ps = f.pageSize || 10;
    const from = ((f.page || 1) - 1) * ps;
    q = q.range(from, from + ps - 1);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  };
}

export function buildVendorProfileQuery(vendorName: string) {
  return async () => {
    if (!supabase) return null;
    const { data: mentions } = await supabase
      .from("vendor_mentions")
      .select("type")
      .eq("vendor_name", vendorName);
    const total = mentions?.length ?? 0;
    const pos = mentions?.filter((m) => m.type === "positive").length ?? 0;
    return { stats: { totalMentions: total, positiveCount: pos, warningCount: total - pos } };
  };
}

export function buildVendorsListQuery() {
  return async () => {
    if (!supabase) return [];
    const { data } = await supabase
      .from("vendor_mentions")
      .select("vendor_name");
    const counts = new Map<string, number>();
    data?.forEach((m) => {
      const k = m.vendor_name.toLowerCase();
      counts.set(k, (counts.get(k) ?? 0) + 1);
    });
    return [...counts.entries()]
      .map(([, c]) => ({ name: "", mentionCount: c }))
      .sort((a, b) => b.mentionCount - a.mentionCount);
  };
}
