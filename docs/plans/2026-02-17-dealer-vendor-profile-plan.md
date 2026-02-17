# Dealer Vendor Profile Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the vendor profile page into a dealer research tool with theme clusters, peer comparisons, mention filters, and sentiment trends.

**Architecture:** Three new Supabase RPC functions (`get_vendor_themes`, `get_compared_vendors`, `get_vendor_trend`) deployed via SQL editor, two new React hooks to call them, and modifications to VendorProfile.tsx to remove the Pulse Score and add four new sections.

**Tech Stack:** Supabase (PostgreSQL RPCs), React, TypeScript, Tailwind CSS, Shadcn UI components

**Important context:**
- The MCP Supabase tools are connected to the WRONG project (`rixrkhumtmhzfgavzjyn`). The correct project is `nsfrxtpxzdmqlezvvjgg`. All SQL must be deployed by the user via the Supabase SQL editor. Provide the SQL and curl verification commands.
- There is no test framework in this project. Verify DB functions via curl, frontend via `vite build`.
- The `get_vendor_profile` RPC source is not available to modify directly. Create a separate `get_vendor_trend` RPC instead.
- All `.rpc()` calls in this codebase use `as any` casts because the Supabase types file doesn't define these functions. Follow the same pattern.

---

## Task 1: Deploy `get_vendor_themes` RPC

**Files:**
- SQL to run in Supabase SQL editor (provide to user)

**Step 1: Present SQL to user for deployment**

The user must run this in the Supabase SQL editor for project `nsfrxtpxzdmqlezvvjgg`:

```sql
CREATE OR REPLACE FUNCTION get_vendor_themes(p_vendor_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'positiveThemes', COALESCE((
      SELECT jsonb_agg(t ORDER BY t->>'mention_count' DESC)
      FROM (
        SELECT jsonb_build_object(
          'theme', title,
          'mention_count', COUNT(*)::int,
          'percentage', ROUND(COUNT(*)::numeric / NULLIF(SUM(COUNT(*)) OVER(), 0) * 100)::int,
          'sample_quote', (array_agg(quote ORDER BY conversation_time DESC))[1]
        ) AS t
        FROM vendor_mentions
        WHERE vendor_name = p_vendor_name AND type = 'positive'
        GROUP BY title
        ORDER BY COUNT(*) DESC
        LIMIT 5
      ) sub
    ), '[]'::jsonb),
    'warningThemes', COALESCE((
      SELECT jsonb_agg(t ORDER BY t->>'mention_count' DESC)
      FROM (
        SELECT jsonb_build_object(
          'theme', title,
          'mention_count', COUNT(*)::int,
          'percentage', ROUND(COUNT(*)::numeric / NULLIF(SUM(COUNT(*)) OVER(), 0) * 100)::int,
          'sample_quote', (array_agg(quote ORDER BY conversation_time DESC))[1]
        ) AS t
        FROM vendor_mentions
        WHERE vendor_name = p_vendor_name AND type = 'warning'
        GROUP BY title
        ORDER BY COUNT(*) DESC
        LIMIT 5
      ) sub
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;
```

**Step 2: Verify via curl**

Run:
```bash
curl -s 'https://nsfrxtpxzdmqlezvvjgg.supabase.co/rest/v1/rpc/get_vendor_themes' \
  -H 'apikey: <anon_key>' \
  -H 'Content-Type: application/json' \
  -d '{"p_vendor_name": "DriveCentric"}'
```

Expected: JSON with `positiveThemes` array (DriveCentric has 60+ positive mentions) and `warningThemes` array.

**Step 3: Commit** — No code changes for this task (SQL deployed externally).

---

## Task 2: Deploy `get_compared_vendors` RPC

**Files:**
- SQL to run in Supabase SQL editor

**Step 1: Present SQL to user for deployment**

```sql
CREATE OR REPLACE FUNCTION get_compared_vendors(p_vendor_name text, p_limit int DEFAULT 4)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  co_occurrence_results jsonb;
  co_count int;
  vendor_categories text[];
BEGIN
  -- Stage 1: Co-occurrence from vendor_processing_queue
  -- Find vendors that appear in the same ai_response mentions array
  SELECT COALESCE(jsonb_agg(row_to_json(co)::jsonb ORDER BY co.co_occurrence_count DESC), '[]'::jsonb)
  INTO co_occurrence_results
  FROM (
    SELECT
      peer.vendor_name,
      COUNT(DISTINCT vpq.id) AS co_occurrence_count
    FROM wam.vendor_processing_queue vpq,
      jsonb_array_elements(vpq.ai_response->'mentions') AS target_mention,
      jsonb_array_elements(vpq.ai_response->'mentions') AS peer_mention
    CROSS JOIN LATERAL (
      SELECT peer_mention->>'vendor_name' AS vendor_name
    ) peer
    WHERE vpq.status = 'processed'
      AND target_mention->>'vendor_name' = p_vendor_name
      AND peer.vendor_name != p_vendor_name
      AND peer.vendor_name IS NOT NULL
    GROUP BY peer.vendor_name
    ORDER BY COUNT(DISTINCT vpq.id) DESC
    LIMIT p_limit
  ) co;

  co_count := COALESCE(jsonb_array_length(co_occurrence_results), 0);

  -- Get categories for this vendor (for fallback)
  SELECT ARRAY(
    SELECT DISTINCT category FROM vendor_mentions WHERE vendor_name = p_vendor_name
  ) INTO vendor_categories;

  -- Stage 2: Fill remaining slots with same-category top vendors if needed
  IF co_count < p_limit AND array_length(vendor_categories, 1) > 0 THEN
    SELECT jsonb_agg(row_to_json(fb)::jsonb ORDER BY fb.mention_count DESC)
    INTO result
    FROM (
      -- Existing co-occurrence results
      SELECT
        e->>'vendor_name' AS vendor_name,
        (e->>'co_occurrence_count')::int AS co_occurrence_count,
        TRUE AS from_co_occurrence
      FROM jsonb_array_elements(co_occurrence_results) e

      UNION ALL

      -- Fallback: top vendors in same categories
      SELECT
        vm.vendor_name,
        NULL::int AS co_occurrence_count,
        FALSE AS from_co_occurrence
      FROM vendor_mentions vm
      WHERE vm.category = ANY(vendor_categories)
        AND vm.vendor_name != p_vendor_name
        AND vm.vendor_name NOT IN (
          SELECT e->>'vendor_name' FROM jsonb_array_elements(co_occurrence_results) e
        )
      GROUP BY vm.vendor_name
      ORDER BY COUNT(*) DESC
      LIMIT (p_limit - co_count)
    ) fb;
  ELSE
    result := co_occurrence_results;
  END IF;

  -- Enrich with mention counts and sentiment
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'vendor_name', r->>'vendor_name',
      'co_occurrence_count', CASE WHEN (r->>'from_co_occurrence')::boolean THEN (r->>'co_occurrence_count')::int ELSE NULL END,
      'mention_count', COALESCE(stats.total, 0),
      'positive_percent', COALESCE(stats.pos_pct, 0)
    )
  ), '[]'::jsonb)
  INTO result
  FROM jsonb_array_elements(COALESCE(result, '[]'::jsonb)) r
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*)::int AS total,
      ROUND(COUNT(*) FILTER (WHERE type = 'positive')::numeric / NULLIF(COUNT(*), 0) * 100)::int AS pos_pct
    FROM vendor_mentions
    WHERE vendor_name = r->>'vendor_name'
  ) stats ON TRUE;

  RETURN jsonb_build_object('vendors', result);
END;
$$;
```

**Step 2: Verify via curl**

Run:
```bash
curl -s 'https://nsfrxtpxzdmqlezvvjgg.supabase.co/rest/v1/rpc/get_compared_vendors' \
  -H 'apikey: <anon_key>' \
  -H 'Content-Type: application/json' \
  -d '{"p_vendor_name": "DriveCentric"}'
```

Expected: JSON with `vendors` array containing up to 4 vendors with `vendor_name`, `mention_count`, `positive_percent`, and optionally `co_occurrence_count`.

**Step 3: Commit** — No code changes for this task.

---

## Task 3: Deploy `get_vendor_trend` RPC

**Files:**
- SQL to run in Supabase SQL editor

**Step 1: Present SQL to user for deployment**

```sql
CREATE OR REPLACE FUNCTION get_vendor_trend(p_vendor_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_total int;
  current_positive int;
  previous_total int;
  previous_positive int;
  current_pct int;
  previous_pct int;
  direction text;
  vol_change int;
BEGIN
  -- Last 30 days
  SELECT
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE type = 'positive')::int
  INTO current_total, current_positive
  FROM vendor_mentions
  WHERE vendor_name = p_vendor_name
    AND conversation_time >= NOW() - INTERVAL '30 days';

  -- Previous 30 days (30-60 days ago)
  SELECT
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE type = 'positive')::int
  INTO previous_total, previous_positive
  FROM vendor_mentions
  WHERE vendor_name = p_vendor_name
    AND conversation_time >= NOW() - INTERVAL '60 days'
    AND conversation_time < NOW() - INTERVAL '30 days';

  -- Not enough data
  IF previous_total < 3 THEN
    RETURN NULL;
  END IF;

  current_pct := ROUND(current_positive::numeric / NULLIF(current_total, 0) * 100)::int;
  previous_pct := ROUND(previous_positive::numeric / NULLIF(previous_total, 0) * 100)::int;

  IF current_pct - previous_pct >= 5 THEN
    direction := 'up';
  ELSIF previous_pct - current_pct >= 5 THEN
    direction := 'down';
  ELSE
    direction := 'stable';
  END IF;

  vol_change := CASE WHEN previous_total > 0
    THEN ROUND((current_total - previous_total)::numeric / previous_total * 100)::int
    ELSE 0
  END;

  RETURN jsonb_build_object(
    'currentPositivePct', current_pct,
    'previousPositivePct', previous_pct,
    'direction', direction,
    'mentionVolumeChangePct', vol_change
  );
END;
$$;
```

**Step 2: Verify via curl**

Run:
```bash
curl -s 'https://nsfrxtpxzdmqlezvvjgg.supabase.co/rest/v1/rpc/get_vendor_trend' \
  -H 'apikey: <anon_key>' \
  -H 'Content-Type: application/json' \
  -d '{"p_vendor_name": "DriveCentric"}'
```

Expected: JSON with `currentPositivePct`, `previousPositivePct`, `direction`, `mentionVolumeChangePct` — OR `null` if insufficient historical data.

**Step 3: Commit** — No code changes for this task.

---

## Task 4: Create `fetchVendorThemes` and `fetchComparedVendors` and `fetchVendorTrend` in useSupabaseVendorData.ts

**Files:**
- Modify: `src/hooks/useSupabaseVendorData.ts`

**Step 1: Add TypeScript interfaces**

Add after the existing `VendorProfileResult` interface (around line 49):

```typescript
export interface VendorTheme {
  theme: string;
  mention_count: number;
  percentage: number;
  sample_quote: string;
}

export interface VendorThemesResult {
  positiveThemes: VendorTheme[];
  warningThemes: VendorTheme[];
}

export interface ComparedVendor {
  vendor_name: string;
  mention_count: number;
  positive_percent: number;
  co_occurrence_count: number | null;
}

export interface VendorTrendResult {
  currentPositivePct: number;
  previousPositivePct: number;
  direction: "up" | "down" | "stable";
  mentionVolumeChangePct: number;
}
```

**Step 2: Add fetch functions**

Add after `fetchVendorInsight` (after line 205):

```typescript
/**
 * Fetch vendor theme clusters (positive and warning)
 */
export async function fetchVendorThemes(
  vendorName: string
): Promise<VendorThemesResult> {
  const { data, error } = await supabase.rpc("get_vendor_themes", {
    p_vendor_name: vendorName,
  });

  if (error) {
    console.error("[Supabase] get_vendor_themes error:", error);
    throw error;
  }

  const result = data as any;
  return {
    positiveThemes: result?.positiveThemes || [],
    warningThemes: result?.warningThemes || [],
  };
}

/**
 * Fetch vendors frequently compared alongside this vendor
 */
export async function fetchComparedVendors(
  vendorName: string
): Promise<ComparedVendor[]> {
  const { data, error } = await supabase.rpc("get_compared_vendors", {
    p_vendor_name: vendorName,
  });

  if (error) {
    console.error("[Supabase] get_compared_vendors error:", error);
    throw error;
  }

  return (data as any)?.vendors || [];
}

/**
 * Fetch vendor sentiment trend (last 30 days vs previous 30 days)
 */
export async function fetchVendorTrend(
  vendorName: string
): Promise<VendorTrendResult | null> {
  const { data, error } = await supabase.rpc("get_vendor_trend", {
    p_vendor_name: vendorName,
  });

  if (error) {
    console.error("[Supabase] get_vendor_trend error:", error);
    throw error;
  }

  return data as any;
}
```

**Step 3: Verify build**

Run: `cd /Users/jasonmayhew/Pulselovable/cdgpulsecom && npx vite build`
Expected: Build succeeds with no errors.

**Step 4: Commit**

```bash
git add src/hooks/useSupabaseVendorData.ts
git commit -m "feat: add fetchVendorThemes, fetchComparedVendors, fetchVendorTrend data functions"
```

---

## Task 5: Remove Pulse Score from VendorProfile.tsx

**Files:**
- Modify: `src/pages/VendorProfile.tsx`

**Step 1: Remove Pulse Score state and memos**

Remove these blocks from VendorProfile.tsx:
- `pulseScore` useMemo (lines ~201-207)
- `scoreTheme` useMemo (lines ~209-239)
- `circumference` const (line ~242)
- `ringOffset` and `displayScore` useState (lines ~243-244)
- Ring animation useEffect (lines ~246-267)

**Step 2: Remove Pulse Score JSX**

Remove the entire Pulse Score overlay block inside the hero section — the `<div>` starting with the comment `{/* Pulse Score — overlapping banner, top-right */}` (lines ~549-591). Also remove the `<defs>` gradient and SVG ring.

**Step 3: Remove unused imports**

The Pulse Score removal may leave unused imports. Check and remove if no longer used elsewhere in the file. Specifically check if `Bricolage Grotesque` font link in `<Helmet>` is still needed (it is — used by vendor name h1 and Total Mentions number).

**Step 4: Verify build**

Run: `cd /Users/jasonmayhew/Pulselovable/cdgpulsecom && npx vite build`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add src/pages/VendorProfile.tsx
git commit -m "feat: remove unreliable Pulse Score from vendor profile"
```

---

## Task 6: Add sentiment trend to Total Mentions card

**Files:**
- Modify: `src/pages/VendorProfile.tsx`

**Step 1: Add trend state and data fetching**

Add import for `fetchVendorTrend` and `VendorTrendResult` from `useSupabaseVendorData`. Add state:

```typescript
const [trend, setTrend] = useState<VendorTrendResult | null>(null);
```

Add useEffect to fetch trend alongside existing profile fetch:

```typescript
useEffect(() => {
  if (!vendorName) return;
  fetchVendorTrend(vendorName).then(setTrend).catch(() => {});
}, [vendorName]);
```

**Step 2: Replace hardcoded trend in Total Mentions card**

Replace the existing static trend indicator (the `<div className="mt-3 flex items-center gap-1.5">` block inside the Total Mentions card, lines ~955-973) with:

```tsx
<div className="mt-3 flex items-center gap-1.5">
  {trend ? (
    <>
      {trend.direction === "up" && <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />}
      {trend.direction === "down" && <TrendingDown className="h-3.5 w-3.5 text-red-400" />}
      {trend.direction === "stable" && <TrendingUp className="h-3.5 w-3.5 text-slate-400" />}
      <span className="text-xs text-slate-500">
        Sentiment{" "}
        <span className={cn(
          "font-bold",
          trend.direction === "up" ? "text-emerald-600" :
          trend.direction === "down" ? "text-red-500" : "text-slate-500"
        )}>
          {trend.direction === "up" ? "trending up" :
           trend.direction === "down" ? "declining" : "stable"}
        </span>
        {trend.direction !== "stable" && (
          <span className="text-slate-400 ml-1">
            ({trend.direction === "up" ? "+" : ""}{trend.currentPositivePct - trend.previousPositivePct}pp)
          </span>
        )}
      </span>
    </>
  ) : (
    <span className="text-[11px] text-slate-400">Not enough historical data for trend</span>
  )}
</div>
```

**Step 3: Verify build**

Run: `cd /Users/jasonmayhew/Pulselovable/cdgpulsecom && npx vite build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/pages/VendorProfile.tsx
git commit -m "feat: add real sentiment trend to vendor profile Total Mentions card"
```

---

## Task 7: Add "Frequently Compared With" section

**Files:**
- Modify: `src/pages/VendorProfile.tsx`

**Step 1: Add compared vendors state and data fetching**

Add import for `fetchComparedVendors` and `ComparedVendor`. Add state:

```typescript
const [comparedVendors, setComparedVendors] = useState<ComparedVendor[]>([]);
```

Add useEffect:

```typescript
useEffect(() => {
  if (!vendorName) return;
  fetchComparedVendors(vendorName).then(setComparedVendors).catch(() => {});
}, [vendorName]);
```

**Step 2: Add "Frequently Compared With" section JSX**

Insert new section between the stats row (`</section>`) and the pros/cons section. Only render if `comparedVendors.length >= 2`:

```tsx
{comparedVendors.length >= 2 && (
  <section className="mb-6">
    <h2
      className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 mb-1"
      style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
    >
      Frequently Compared With
    </h2>
    <p className="text-[11px] text-slate-400 mb-4">
      Vendors dealers often evaluate alongside {profileData.vendorName}
    </p>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {comparedVendors.map((v) => {
        const logoDevToken = import.meta.env.VITE_LOGO_DEV_TOKEN;
        const domain = v.vendor_name.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9.-]/g, "") + ".com";
        const peerLogo = logoDevToken
          ? `https://img.logo.dev/${domain}?token=${logoDevToken}&size=64&format=png&fallback=monogram`
          : null;
        return (
          <button
            key={v.vendor_name}
            onClick={() => navigate(`/vendors/${encodeURIComponent(v.vendor_name)}`)}
            className="bg-white rounded-xl border border-border/50 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-md hover:border-border transition-all text-left group"
          >
            <div className="flex items-center gap-2.5 mb-3">
              <Avatar className="h-8 w-8 bg-white border border-border/30">
                <AvatarImage src={peerLogo || undefined} alt={v.vendor_name} />
                <AvatarFallback className="text-[10px] font-bold bg-slate-50 text-slate-500">
                  {v.vendor_name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-semibold text-slate-800 group-hover:text-primary transition-colors truncate">
                {v.vendor_name}
              </span>
            </div>
            <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-100 mb-2">
              <div
                className="bg-emerald-400 transition-all"
                style={{ width: `${v.positive_percent}%` }}
              />
              <div
                className="bg-red-300 transition-all"
                style={{ width: `${100 - v.positive_percent}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400">{v.mention_count} mentions</span>
              <span className="text-[10px] font-medium text-emerald-600">{v.positive_percent}% positive</span>
            </div>
          </button>
        );
      })}
    </div>
  </section>
)}
```

**Step 3: Verify build**

Run: `cd /Users/jasonmayhew/Pulselovable/cdgpulsecom && npx vite build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/pages/VendorProfile.tsx
git commit -m "feat: add Frequently Compared With section to vendor profile"
```

---

## Task 8: Replace "Coming Soon" with real theme clusters

**Files:**
- Modify: `src/pages/VendorProfile.tsx`

**Step 1: Add themes state and data fetching**

Add import for `fetchVendorThemes`, `VendorThemesResult`, `VendorTheme`. Add state:

```typescript
const [themes, setThemes] = useState<VendorThemesResult | null>(null);
```

Add useEffect:

```typescript
useEffect(() => {
  if (!vendorName) return;
  fetchVendorThemes(vendorName).then(setThemes).catch(() => {});
}, [vendorName]);
```

**Step 2: Replace the pros/cons section**

Replace the entire "PROS & CONS" section (lines ~977-1018, the two "coming soon" placeholder cards) with:

```tsx
<section className="mb-6">
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {/* What dealers appreciate */}
    <div className="bg-white rounded-2xl border border-border/50 p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-2.5 mb-5">
        <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center">
          <ThumbsUp className="h-4 w-4 text-emerald-600" />
        </div>
        <h3 className="text-sm font-bold text-slate-800">What Dealers Appreciate</h3>
      </div>
      {themes?.positiveThemes && themes.positiveThemes.length > 0 ? (
        <ul className="space-y-3">
          {themes.positiveThemes.map((t, i) => (
            <li key={i} className="group">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[13px] font-semibold text-slate-700 leading-snug">{t.theme}</span>
                    <span className="flex-shrink-0 text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                      {t.mention_count}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">{t.sample_quote}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-400 py-4 text-center">No positive themes recorded yet</p>
      )}
    </div>

    {/* Common concerns */}
    <div className="bg-white rounded-2xl border border-border/50 p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-2.5 mb-5">
        <div className="h-8 w-8 rounded-lg bg-red-100 flex items-center justify-center">
          <AlertTriangle className="h-4 w-4 text-red-500" />
        </div>
        <h3 className="text-sm font-bold text-slate-800">Common Concerns</h3>
      </div>
      {themes?.warningThemes && themes.warningThemes.length > 0 ? (
        <ul className="space-y-3">
          {themes.warningThemes.map((t, i) => (
            <li key={i} className="group">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[13px] font-semibold text-slate-700 leading-snug">{t.theme}</span>
                    <span className="flex-shrink-0 text-[10px] font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">
                      {t.mention_count}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">{t.sample_quote}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-400 py-4 text-center">No concerns recorded yet</p>
      )}
    </div>
  </div>
</section>
```

**Step 3: Remove the Sparkles import if it's no longer used elsewhere in the file**

Check if `Sparkles` is still used in the CDG Intelligence strip. If yes, keep it. If the only uses were in the "coming soon" placeholders, remove from the import.

**Step 4: Verify build**

Run: `cd /Users/jasonmayhew/Pulselovable/cdgpulsecom && npx vite build`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add src/pages/VendorProfile.tsx
git commit -m "feat: replace coming-soon placeholders with real theme clusters"
```

---

## Task 9: Add mention filter tabs

**Files:**
- Modify: `src/pages/VendorProfile.tsx`

**Step 1: Add filter state**

Add state near the other useState declarations:

```typescript
const [mentionFilter, setMentionFilter] = useState<"all" | "positive" | "warning">("all");
```

Add filtered mentions memo:

```typescript
const filteredMentions = useMemo(() => {
  if (mentionFilter === "all") return allMentions;
  return allMentions.filter((m) => m.type === mentionFilter);
}, [allMentions, mentionFilter]);
```

**Step 2: Add filter tabs JSX**

Insert filter tabs inside the Community Mentions section, after the header `<div>` and before the mentions grid. Place it right after the `<div>` containing the h2 "Community Mentions" and the "X shown" span (the `<div className="flex items-end justify-between mb-5">` block):

```tsx
<div className="flex items-center gap-2 mb-4">
  {(["all", "positive", "warning"] as const).map((filter) => {
    const count = filter === "all"
      ? allMentions.length
      : allMentions.filter((m) => m.type === filter).length;
    const label = filter === "all" ? "All" : filter === "positive" ? "Positive" : "Concerns";
    return (
      <button
        key={filter}
        onClick={() => setMentionFilter(filter)}
        className={cn(
          "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
          mentionFilter === filter
            ? "bg-slate-900 text-white"
            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
        )}
      >
        {label}
        <span className={cn(
          "ml-1.5 tabular-nums",
          mentionFilter === filter ? "text-white/70" : "text-slate-400"
        )}>
          {count}
        </span>
      </button>
    );
  })}
</div>
```

**Step 3: Update the mentions grid to use `filteredMentions`**

Replace all references to `allMentions` in the rendering of the mentions grid and the "X shown" count with `filteredMentions`. Specifically:

- The `.map()` that renders `VendorCard` components — change `allMentions.map` to `filteredMentions.map`
- The "X shown" span — change `allMentions.length` to `filteredMentions.length`
- The empty state check — change `allMentions.length === 0` to `filteredMentions.length === 0`

Keep `allMentions` for the filter count badges (those always show total counts per type).

**Step 4: Verify build**

Run: `cd /Users/jasonmayhew/Pulselovable/cdgpulsecom && npx vite build`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add src/pages/VendorProfile.tsx
git commit -m "feat: add mention type filter tabs to vendor profile"
```

---

## Task 10: Final verification

**Step 1: Full build check**

Run: `cd /Users/jasonmayhew/Pulselovable/cdgpulsecom && npx vite build`
Expected: Build succeeds with no errors.

**Step 2: Verify all 3 RPCs respond correctly**

Run curl for each:
- `get_vendor_themes` with "DriveCentric"
- `get_compared_vendors` with "DriveCentric"
- `get_vendor_trend` with "DriveCentric"

All should return valid JSON responses.

**Step 3: Manual browser test**

Run `npm run dev` and navigate to `/vendors/DriveCentric`. Verify:
- No Pulse Score ring visible
- Sentiment breakdown and Total Mentions cards display correctly
- Trend indicator shows real data or "Not enough historical data"
- "Frequently Compared With" section shows peer vendors (if 2+ found)
- "What Dealers Appreciate" and "Common Concerns" show theme lists
- Filter tabs (All/Positive/Concerns) work and filter the mentions grid
- All vendor peer cards link to their respective profiles

**Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "feat: complete dealer vendor profile redesign"
```
