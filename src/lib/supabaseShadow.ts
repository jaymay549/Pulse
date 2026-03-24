import { createClient } from "@supabase/supabase-js";
import { WAM_URL } from "@/config/wam";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

// Rate limit: one log per endpoint per 5 min
const lastLogged = new Map<string, number>();
const RATE_MS = 5 * 60_000;

function isLocalhost(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.hostname === "localhost" ||
      u.hostname === "127.0.0.1" ||
      u.hostname === "0.0.0.0" ||
      u.hostname === "::1"
    );
  } catch {
    return url.includes("localhost") || url.includes("127.0.0.1");
  }
}

export interface ShadowCompareContext {
  /** Clerk user tier at the time of comparison */
  userTier?: string | null;
  /** Request filters/params sent to both sources */
  requestPayload?: Record<string, unknown>;
}

/**
 * Fire-and-forget shadow compare. Fetches from Supabase, compares with WAM
 * response, logs mismatches with full context. Never throws.
 *
 * Skips comparison when WAM_URL points to localhost (dev environment).
 * Only compares when the user has Pro-level access — Free-tier WAM responses
 * are intentionally redacted/limited, so comparing them against raw Supabase
 * data would produce false-positive mismatches.
 */
export async function shadowCompare(
  endpoint: string,
  wamData: unknown,
  query: () => Promise<unknown>,
  ctx: ShadowCompareContext = {},
) {
  if (!supabase) return;

  // Skip for localhost WAM — dev environment, not meaningful to compare
  if (isLocalhost(WAM_URL)) return;

  // Skip for non-pro users — WAM redacts data for free tier, so diffs are expected
  const tier = ctx.userTier?.toLowerCase() ?? "free";
  const isProTier =
    tier === "pro" || tier === "executive" || tier === "viewer" || tier === "verified_vendor";
  if (!isProTier) return;

  const now = Date.now();
  const rateKey = `${endpoint}::${JSON.stringify(ctx.requestPayload ?? {})}`;
  if (now - (lastLogged.get(rateKey) ?? 0) < RATE_MS) return;

  try {
    const sbData = await query();
    const diff = detectDiff(endpoint, wamData, sbData);
    if (diff) {
      lastLogged.set(rateKey, now);
      supabase
        .from("shadow_read_logs")
        .insert({
          endpoint,
          diff: diff.summary,
          diff_type: diff.type,
          wam_url: WAM_URL,
          supabase_url: SUPABASE_URL,
          user_tier: tier,
          request_payload: ctx.requestPayload ?? null,
          wam_value: diff.wamValue,
          supabase_value: diff.sbValue,
        })
        .then(() => {});
    }
  } catch {
    // silent
  }
}

interface DiffResult {
  summary: string;
  type: string;
  wamValue: string;
  sbValue: string;
}

function detectDiff(
  endpoint: string,
  wam: any,
  sb: any,
): DiffResult | null {
  if (endpoint.includes("/mentions")) {
    const wc = wam?.totalCount ?? 0;
    const sc = sb?.length ?? 0;
    if (wc !== sc)
      return {
        summary: `Mention count mismatch: WAM=${wc}, Supabase=${sc}`,
        type: "count_mismatch",
        wamValue: String(wc),
        sbValue: String(sc),
      };
  } else if (endpoint.includes("/profile")) {
    const ws = wam?.stats;
    const ss = sb?.stats;
    if (ws?.totalMentions !== ss?.totalMentions)
      return {
        summary: `Total mentions mismatch: WAM=${ws?.totalMentions}, Supabase=${ss?.totalMentions}`,
        type: "count_mismatch",
        wamValue: String(ws?.totalMentions ?? "null"),
        sbValue: String(ss?.totalMentions ?? "null"),
      };
  } else if (endpoint.includes("/vendors-list")) {
    const wc = wam?.vendors?.length ?? 0;
    const sc = sb?.length ?? 0;
    if (wc !== sc)
      return {
        summary: `Vendor list count mismatch: WAM=${wc}, Supabase=${sc}`,
        type: "count_mismatch",
        wamValue: String(wc),
        sbValue: String(sc),
      };
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
    const warn = mentions?.filter((m) => m.type === "warning" || m.type === "negative").length ?? 0;
    return { stats: { totalMentions: total, positiveCount: pos, warningCount: warn } };
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
