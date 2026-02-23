# Vendor Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a dedicated vendor dashboard at `/vendor-dashboard` with sidebar navigation and four sections: Overview, Mentions & Respond, Edit Profile, and Market Intel.

**Architecture:** New top-level route with its own layout component (sidebar + content area), modeled after the admin layout pattern but with light theme. Each section is a standalone component rendered via state-based navigation (not sub-routes). The existing `VendorDashboard` component on VendorProfile.tsx is removed and replaced with a "Manage Profile" link.

**Tech Stack:** React, React Query, Supabase (RLS + storage), shadcn/ui components, Tailwind CSS, lucide-react icons

**Design doc:** `docs/plans/2026-02-22-vendor-dashboard-redesign.md`

---

### Task 1: DB Migration — Add Profile Editing Columns + Screenshots Bucket

The `vendor_profiles` table is missing columns that vendors need to edit. Current columns: `company_website`, `company_logo_url`, `company_description`, `contact_email`. Missing: `tagline`, `linkedin_url`, `headquarters`, `banner_url`.

**Files:**
- Create: `supabase/migrations/20260222000000_vendor_profile_editing.sql`

**Step 1: Write and apply the migration**

Apply via Supabase MCP `apply_migration`:

```sql
-- Add editable profile fields
ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS tagline TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
  ADD COLUMN IF NOT EXISTS headquarters TEXT,
  ADD COLUMN IF NOT EXISTS banner_url TEXT;

-- Create vendor-screenshots storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('vendor-screenshots', 'vendor-screenshots', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for vendor-screenshots (mirrors vendor-logos pattern)
CREATE POLICY "Vendor screenshots are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'vendor-screenshots');

CREATE POLICY "Verified vendors can upload screenshots"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'vendor-screenshots'
    AND (auth.jwt() ->> 'sub') IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.vendor_profiles
      WHERE vendor_profiles.user_id = (auth.jwt() ->> 'sub')
        AND vendor_profiles.is_approved = true
        AND vendor_profiles.id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "Verified vendors can delete their screenshots"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'vendor-screenshots'
    AND (auth.jwt() ->> 'sub') IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.vendor_profiles
      WHERE vendor_profiles.user_id = (auth.jwt() ->> 'sub')
        AND vendor_profiles.is_approved = true
        AND vendor_profiles.id::text = (storage.foldername(name))[1]
    )
  );
```

**Step 2: Save the migration file locally** (same SQL as above)

**Step 3: Commit**

```bash
git add supabase/migrations/20260222000000_vendor_profile_editing.sql
git commit -m "feat: add vendor profile editing columns and screenshots bucket"
```

---

### Task 2: Vendor Dashboard Layout + Sidebar

Create the layout shell: sidebar with navigation on left, content area on right. Light theme. Modeled after `src/components/admin/AdminLayout.tsx` and `src/components/admin/AdminSidebar.tsx` but with light colors.

**Files:**
- Create: `src/components/vendor-dashboard/VendorDashboardSidebar.tsx`
- Create: `src/components/vendor-dashboard/VendorDashboardLayout.tsx`

**Step 1: Create the sidebar**

Create `src/components/vendor-dashboard/VendorDashboardSidebar.tsx`:

```tsx
import { BarChart3, MessageSquare, Pencil, TrendingUp, ExternalLink, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type Section = "overview" | "mentions" | "profile" | "intel";

interface VendorDashboardSidebarProps {
  vendorName: string;
  activeSection: Section;
  onNavigate: (section: Section) => void;
}

const navItems: { id: Section; icon: typeof BarChart3; label: string }[] = [
  { id: "overview", icon: BarChart3, label: "Overview" },
  { id: "mentions", icon: MessageSquare, label: "Mentions" },
  { id: "profile", icon: Pencil, label: "Edit Profile" },
  { id: "intel", icon: TrendingUp, label: "Market Intel" },
];

export function VendorDashboardSidebar({ vendorName, activeSection, onNavigate }: VendorDashboardSidebarProps) {
  return (
    <aside className="w-56 border-r bg-white flex flex-col h-full">
      <div className="p-4 border-b">
        <p className="text-sm font-semibold text-slate-900 truncate">{vendorName}</p>
        <p className="text-xs text-slate-500 mt-0.5">Vendor Dashboard</p>
      </div>

      <nav className="flex-1 p-2 space-y-0.5">
        {navItems.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              activeSection === id
                ? "bg-slate-100 text-slate-900"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            )}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            {label}
          </button>
        ))}
      </nav>

      <div className="p-2 border-t space-y-0.5">
        <a
          href={`/vendors/${encodeURIComponent(vendorName)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
          View as Member
        </a>
        <a
          href="/vendors"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to CDG Pulse
        </a>
      </div>
    </aside>
  );
}
```

**Step 2: Create the layout**

Create `src/components/vendor-dashboard/VendorDashboardLayout.tsx`:

```tsx
import { useState } from "react";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { VendorDashboardSidebar } from "./VendorDashboardSidebar";

export type DashboardSection = "overview" | "mentions" | "profile" | "intel";

interface VendorDashboardLayoutProps {
  vendorName: string;
  activeSection: DashboardSection;
  onNavigate: (section: DashboardSection) => void;
  children: React.ReactNode;
}

export function VendorDashboardLayout({ vendorName, activeSection, onNavigate, children }: VendorDashboardLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNavigate = (section: DashboardSection) => {
    onNavigate(section);
    setMobileOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex">
        <VendorDashboardSidebar vendorName={vendorName} activeSection={activeSection} onNavigate={handleNavigate} />
      </div>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b px-4 py-3 flex items-center justify-between">
          <SheetTrigger asChild>
            <button className="text-slate-500 hover:text-slate-900">
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <span className="text-sm font-semibold text-slate-900">{vendorName}</span>
          <div className="w-5" />
        </div>
        <SheetContent side="left" className="p-0 w-56">
          <VendorDashboardSidebar vendorName={vendorName} activeSection={activeSection} onNavigate={handleNavigate} />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 overflow-auto p-6 lg:pt-6 pt-16">
          {children}
        </main>
      </div>
    </div>
  );
}
```

**Step 3: Verify build**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/components/vendor-dashboard/
git commit -m "feat: add vendor dashboard layout and sidebar components"
```

---

### Task 3: Vendor Dashboard Page + Route Guard + Routing

Create the main page component with route guard (redirects non-vendors) and wire it into App.tsx.

**Files:**
- Create: `src/pages/VendorDashboardPage.tsx`
- Modify: `src/App.tsx` (add lazy import + route)

**Step 1: Create the page component with guard**

Create `src/pages/VendorDashboardPage.tsx`:

```tsx
import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useClerkSupabase } from "@/hooks/useClerkSupabase";
import { useClerkAuth } from "@/hooks/useClerkAuth";
import { VendorDashboardLayout, type DashboardSection } from "@/components/vendor-dashboard/VendorDashboardLayout";

export default function VendorDashboardPage() {
  const supabase = useClerkSupabase();
  const { user, isAuthenticated, isLoading: authLoading } = useClerkAuth();
  const [activeSection, setActiveSection] = useState<DashboardSection>("overview");

  // Fetch the user's approved vendor profile
  const { data: vendorProfile, isLoading } = useQuery({
    queryKey: ["my-vendor-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_profiles")
        .select("id, vendor_name, is_approved")
        .eq("user_id", user!.id)
        .eq("is_approved", true)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; vendor_name: string; is_approved: boolean } | null;
    },
    enabled: isAuthenticated && !!user?.id,
  });

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!isAuthenticated || !vendorProfile) {
    return <Navigate to="/vendors" replace />;
  }

  const vendorName = vendorProfile.vendor_name;

  return (
    <VendorDashboardLayout vendorName={vendorName} activeSection={activeSection} onNavigate={setActiveSection}>
      <div className="max-w-5xl">
        {activeSection === "overview" && <p className="text-slate-500">Overview coming next...</p>}
        {activeSection === "mentions" && <p className="text-slate-500">Mentions coming next...</p>}
        {activeSection === "profile" && <p className="text-slate-500">Profile editor coming next...</p>}
        {activeSection === "intel" && <p className="text-slate-500">Market intel coming next...</p>}
      </div>
    </VendorDashboardLayout>
  );
}
```

**Step 2: Add route to App.tsx**

In `src/App.tsx`:
- Add lazy import after line 31: `const VendorDashboardPage = lazy(() => import("./pages/VendorDashboardPage"));`
- Add route after line 56 (before admin routes): `<Route path="/vendor-dashboard" element={<Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>}><VendorDashboardPage /></Suspense>} />`
- Add `Loader2` to lucide-react import on line 8 (already imported)

**Step 3: Verify build**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/pages/VendorDashboardPage.tsx src/App.tsx
git commit -m "feat: add vendor dashboard page with route guard"
```

---

### Task 4: Overview Section

Replace the placeholder with real stats + trend + recent activity.

**Files:**
- Create: `src/components/vendor-dashboard/DashboardOverview.tsx`
- Modify: `src/pages/VendorDashboardPage.tsx` (import + render)

**Step 1: Create the overview component**

Create `src/components/vendor-dashboard/DashboardOverview.tsx`:

Uses `get_vendor_profile` RPC for stats, `get_vendor_trend` RPC for trend, and `vendor_mentions` table for recent 5 mentions. Renders:
- 3 stat cards in a row (total mentions + trend badge, positive %, concerns count)
- Recent Activity list (last 5 mentions with headline, type badge, timestamp)
- "View all mentions" button that calls `onNavigate("mentions")`

**Data patterns** (copy from existing VendorDashboard.tsx):
```tsx
// Stats via RPC
const { data: profile } = useQuery({
  queryKey: ["vendor-overview", vendorName],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("get_vendor_profile" as never, { p_vendor_name: vendorName } as never);
    if (error) throw error;
    return data;
  },
});

// Trend via RPC
const { data: trend } = useQuery({
  queryKey: ["vendor-trend", vendorName],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("get_vendor_trend" as never, { p_vendor_name: vendorName } as never);
    if (error) throw error;
    return data;
  },
});

// Recent mentions
const { data: recentMentions = [] } = useQuery({
  queryKey: ["vendor-recent-mentions", vendorName],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("vendor_mentions")
      .select("id, quote, type, created_at")
      .eq("vendor_name", vendorName)
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) throw error;
    return data ?? [];
  },
});
```

**Color coding for positive %:** emerald-600 for >=70%, yellow-600 for 50-69%, red-500 for <50%.

**Trend badge:** ArrowUp (emerald) / ArrowDown (red) / Minus (slate) icon with `mentionVolumeChangePct` value.

**Step 2: Wire into VendorDashboardPage.tsx**

Replace the overview placeholder with `<DashboardOverview vendorName={vendorName} onNavigate={setActiveSection} />`.

**Step 3: Verify build + visual check**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/components/vendor-dashboard/DashboardOverview.tsx src/pages/VendorDashboardPage.tsx
git commit -m "feat: add vendor dashboard overview with stats and recent mentions"
```

---

### Task 5: Mentions & Respond Section

Full-page mention management with filter pills and response composer.

**Files:**
- Create: `src/components/vendor-dashboard/DashboardMentions.tsx`
- Modify: `src/pages/VendorDashboardPage.tsx` (import + render)

**Step 1: Create the mentions component**

Port the logic from `VendorRespondTab` in `src/components/vendors/VendorDashboard.tsx` (lines 20-153) into a full-page component with these additions:
- Filter bar with toggle pills: All | Positive | Concerns (with counts derived from data)
- Full-width mention cards (not squeezed into a tab panel)
- Each card: type badge, quote text, timestamp, response area (textarea + Post button or "Responded" badge)

**Key data queries** (same as existing VendorRespondTab):
- `vendor_mentions` filtered by `vendor_name`, ordered by `created_at DESC`, limit 50
- `vendor_responses` filtered by `mention_id IN [...]` (scoped by org via RLS)
- Insert into `vendor_responses` with `{ mention_id, response_text } as never`

**Filter implementation:** Client-side filter on `mention.type === "positive"` or `"warning"`. Count from `mentions.filter(m => m.type === type).length`.

**Step 2: Wire into VendorDashboardPage.tsx**

Replace mentions placeholder with `<DashboardMentions vendorName={vendorName} />`.

**Step 3: Verify build**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/components/vendor-dashboard/DashboardMentions.tsx src/pages/VendorDashboardPage.tsx
git commit -m "feat: add vendor dashboard mentions section with response composer"
```

---

### Task 6: Edit Profile Section

Form for text fields + image upload components for banner, logo, and screenshots.

**Files:**
- Create: `src/components/vendor-dashboard/DashboardEditProfile.tsx`
- Modify: `src/pages/VendorDashboardPage.tsx` (import + render)

**Step 1: Create the edit profile component**

Two sections:

**Section A — Brand Assets:**
- Banner preview (full width, 200px tall) with "Upload Banner" overlay button. Uploads to `vendor-banners/{profile.id}/banner.{ext}` in Supabase storage.
- Logo preview (80px circle) with "Upload Logo" overlay. Uploads to `vendor-logos/{profile.id}/logo.{ext}`.
- Screenshots gallery grid (4 cols). Uploads to `vendor-screenshots/{profile.id}/{filename}`. "Add Screenshot" button. Delete button per image.

**Image upload pattern:**
```tsx
const handleUpload = async (file: File, bucket: string, path: string) => {
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
  return publicUrl;
};
```

**Section B — Profile Details Form:**
- Fields: tagline, company_description (textarea), company_website, linkedin_url, headquarters, contact_email
- Load current values from `vendor_profiles` query
- "Save Changes" button writes via Supabase update:
```tsx
const { error } = await supabase
  .from("vendor_profiles")
  .update({
    tagline,
    company_description: description,
    company_website: website,
    linkedin_url: linkedin,
    headquarters,
    contact_email: email,
  } as never)
  .eq("user_id", user!.id);
```

**Step 2: Fetch current profile data**

```tsx
const { data: profile } = useQuery({
  queryKey: ["vendor-edit-profile", user?.id],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("vendor_profiles")
      .select("*")
      .eq("user_id", user!.id)
      .eq("is_approved", true)
      .single();
    if (error) throw error;
    return data;
  },
});
```

**Step 3: Wire into VendorDashboardPage.tsx**

Replace profile placeholder with `<DashboardEditProfile />`.

**Step 4: Verify build**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/components/vendor-dashboard/DashboardEditProfile.tsx src/pages/VendorDashboardPage.tsx
git commit -m "feat: add vendor profile editor with image upload and form"
```

---

### Task 7: Market Intel Section

Full-page competitive intelligence. Reuses data pattern from existing `VendorIntelPanel`.

**Files:**
- Create: `src/components/vendor-dashboard/DashboardIntel.tsx`
- Modify: `src/pages/VendorDashboardPage.tsx` (import + render)

**Step 1: Create the intel component**

Port logic from `src/components/vendors/VendorIntelPanel.tsx` into a full-page component:

**Your Position card:** Own stats (total mentions, positive %, concerns) + trend from `get_vendor_trend`.

**Competitor table:** Same as VendorIntelPanel but full-width. Columns: Vendor Name | Mentions | Positive % | Co-occurrences. Own row highlighted with "You" badge.

**Data queries** (same as VendorIntelPanel):
```tsx
// Own profile
const { data: profile } = useQuery({
  queryKey: ["vendor-intel-profile", vendorName],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("get_vendor_profile" as never, { p_vendor_name: vendorName } as never);
    if (error) throw error;
    return data;
  },
});

// Competitors — unwrap .vendors
const { data: competitors = [] } = useQuery({
  queryKey: ["vendor-intel-competitors", vendorName],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("get_compared_vendors" as never, { p_vendor_name: vendorName, p_limit: 4 } as never);
    if (error) throw error;
    return (data as any)?.vendors ?? [];
  },
});
```

**Key:** React key pattern for table rows: `key={\`${row.isOwn ? "own" : "comp"}-${row.name}\`}` to prevent collision.

**Step 2: Wire into VendorDashboardPage.tsx**

Replace intel placeholder with `<DashboardIntel vendorName={vendorName} />`.

**Step 3: Verify build**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/components/vendor-dashboard/DashboardIntel.tsx src/pages/VendorDashboardPage.tsx
git commit -m "feat: add vendor dashboard market intel section"
```

---

### Task 8: VendorProfile.tsx Cleanup — Remove Old Dashboard + Add Manage Button

Remove the embedded `VendorDashboard` component and add a "Manage Profile" button for owners.

**Files:**
- Modify: `src/pages/VendorProfile.tsx`

**Step 1: Remove old dashboard import and render**

In `src/pages/VendorProfile.tsx`:
- Remove import on line 23: `import { VendorDashboard } from "@/components/vendors/VendorDashboard";`
- Remove render on lines 467-468: `{isVendorOwner && <VendorDashboard vendorName={vendorName} />}`

**Step 2: Add "Manage Profile" button for owners**

Replace the claim button block at lines 522-531 with:

```tsx
{isAuthenticated && isVendorOwner && (
  <Link to="/vendor-dashboard">
    <Button variant="outline" size="sm" className="mt-2">
      Manage Profile
    </Button>
  </Link>
)}
{isAuthenticated && !isVendorOwner && (
  <Button
    variant="outline"
    size="sm"
    onClick={() => setClaimModalOpen(true)}
    className="mt-2"
  >
    Claim this profile
  </Button>
)}
```

Ensure `Link` is imported from `react-router-dom` (already imported on line 3).

**Step 3: Verify build**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/pages/VendorProfile.tsx
git commit -m "feat: replace inline vendor dashboard with manage profile link"
```

---

### Task 9: Delete Old VendorDashboard Component

Now that nothing imports it, remove the old component.

**Files:**
- Delete: `src/components/vendors/VendorDashboard.tsx`
- Check: `src/components/vendors/VendorIntelPanel.tsx` — keep if still imported by DashboardIntel, otherwise delete

**Step 1: Verify no remaining imports**

```bash
grep -r "VendorDashboard" src/ --include="*.tsx" --include="*.ts"
```

Should return nothing (or only the old file itself).

**Step 2: Delete the file**

```bash
rm src/components/vendors/VendorDashboard.tsx
```

**Step 3: Check if VendorIntelPanel is still imported**

```bash
grep -r "VendorIntelPanel" src/ --include="*.tsx" --include="*.ts"
```

If only imported by the deleted VendorDashboard.tsx and DashboardIntel doesn't use it, delete it too. If DashboardIntel reuses it, keep it.

**Step 4: Verify build**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove old inline vendor dashboard component"
```
