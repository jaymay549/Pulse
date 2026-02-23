# CDG Pulse V1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the vendor-side V1 — claim flow, admin approval, and a vendor dashboard (Overview / Respond / Market Intel tabs) that transforms the existing VendorProfile page when the verified owner is logged in. Includes member-facing discovery CTA improvements.

**Architecture:** `VendorProfile.tsx` gets a `useVendorOwnership` hook that queries the existing `vendor_profiles` table via RLS — if a row exists for the logged-in user matching the current vendor name, a `VendorDashboard` component renders above the public profile. New admin page at `/admin/claims` handles approval. A new `vendor_claims` table captures inbound requests. All Supabase calls use `useClerkSupabase()` which returns the client directly (not destructured).

**Tech Stack:** React 18 + TypeScript, Supabase (PostgreSQL + RLS + SECURITY DEFINER RPCs), React Query v5 (`@tanstack/react-query`), shadcn-ui (`Tabs`, `Dialog`, `Badge`, `Button`, `Input`, `Textarea`), Clerk (`useClerkAuth`, `useClerkSupabase`), Sonner (toasts), React Router v6, Lucide icons

---

## Key File Reference

| File | Purpose |
|------|---------|
| `src/pages/VendorProfile.tsx` | 1847-line vendor profile page — `vendorName` = `decodeURIComponent(vendorSlug)` at line 83; main content div at line 458; "Frequently Compared With" section at line 864 |
| `src/hooks/useClerkSupabase.ts` | Returns Supabase client directly: `const supabase = useClerkSupabase()` |
| `src/hooks/useClerkAuth.ts` | Returns `{ user, tier, isAuthenticated, isLoading, role }` |
| `src/components/admin/AdminSidebar.tsx` | `navItems` array — add `{ to, icon, label }` entries |
| `src/App.tsx` | Admin routes registered as lazy children of `/admin` |
| `supabase/migrations/` | Migration files — check latest for naming pattern |

---

## Task 1: DB Migration — vendor_claims Table + Admin RPCs

**Files:**
- Create: `supabase/migrations/<timestamp>_vendor_claims.sql`

**Step 1: Check latest migration filename for naming pattern**

List `supabase/migrations/` and note the timestamp format (e.g., `20260121211304_<uuid>.sql`).

**Step 2: Apply migration via Supabase MCP `apply_migration`**

Migration name: `vendor_claims`

```sql
-- vendor_claims: stores inbound vendor ownership requests
CREATE TABLE public.vendor_claims (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_name TEXT NOT NULL,
  claimant_name TEXT NOT NULL,
  claimant_email TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  claimant_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_claims ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert their own claim
CREATE POLICY "Authenticated users can insert their own claim"
  ON public.vendor_claims FOR INSERT TO authenticated
  WITH CHECK (claimant_user_id = auth.uid());

-- Users can view their own claims
CREATE POLICY "Users can view their own claims"
  ON public.vendor_claims FOR SELECT TO authenticated
  USING (claimant_user_id = auth.uid());

-- ── Admin RPCs (SECURITY DEFINER — bypass RLS for admin operations) ──────────

-- List all claims ordered newest first (admin only — caller checks role in app)
CREATE OR REPLACE FUNCTION public.get_vendor_claims()
RETURNS TABLE (
  id UUID, vendor_name TEXT, claimant_name TEXT,
  claimant_email TEXT, note TEXT, status TEXT,
  claimant_user_id UUID, created_at TIMESTAMPTZ
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT id, vendor_name, claimant_name, claimant_email,
         note, status, claimant_user_id, created_at
  FROM vendor_claims
  ORDER BY created_at DESC;
$$;

-- Approve a claim: creates vendor_profiles row + marks claim approved
CREATE OR REPLACE FUNCTION public.approve_vendor_claim(
  p_claim_id UUID,
  p_vendor_name TEXT,
  p_claimant_user_id UUID
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO vendor_profiles (user_id, vendor_name, is_approved, approved_at)
  VALUES (p_claimant_user_id, p_vendor_name, true, now())
  ON CONFLICT (user_id)
  DO UPDATE SET vendor_name = EXCLUDED.vendor_name,
                is_approved = true,
                approved_at = now();

  UPDATE vendor_claims
  SET status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now()
  WHERE id = p_claim_id;
END;
$$;

-- Reject a claim
CREATE OR REPLACE FUNCTION public.reject_vendor_claim(p_claim_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE vendor_claims
  SET status = 'rejected',
      reviewed_by = auth.uid(),
      reviewed_at = now()
  WHERE id = p_claim_id;
END;
$$;
```

**Step 3: Verify in Supabase**

Use MCP `list_tables` on the public schema — confirm `vendor_claims` appears. Then run `execute_sql` to verify the RPCs exist:

```sql
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('get_vendor_claims', 'approve_vendor_claim', 'reject_vendor_claim');
```

Expected: 3 rows returned.

**Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: add vendor_claims table and admin claim RPCs"
```

---

## Task 2: Vendor Ownership Hook + Dashboard Shell (V1)

**Files:**
- Create: `src/hooks/useVendorOwnership.ts`
- Create: `src/components/vendors/VendorDashboard.tsx`
- Modify: `src/pages/VendorProfile.tsx`

**Step 1: Create `useVendorOwnership` hook**

Create `src/hooks/useVendorOwnership.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";
import { useClerkSupabase } from "./useClerkSupabase";
import { useClerkAuth } from "./useClerkAuth";

interface VendorOwnership {
  id: string;
  vendor_name: string;
  is_approved: boolean;
}

/**
 * Returns the vendor_profiles row for the current user if they are
 * the approved owner of `vendorName`. Returns null if not owner.
 * Uses RLS — the query only returns data if user_id = auth.uid().
 */
export function useVendorOwnership(vendorName: string | undefined) {
  const supabase = useClerkSupabase();
  const { user, isAuthenticated } = useClerkAuth();

  return useQuery<VendorOwnership | null>({
    queryKey: ["vendor-ownership", vendorName, user?.id],
    queryFn: async () => {
      if (!vendorName) return null;
      const { data, error } = await supabase
        .from("vendor_profiles")
        .select("id, vendor_name, is_approved")
        .eq("vendor_name", vendorName)
        .eq("is_approved", true)
        .maybeSingle();
      if (error) throw error;
      return data as VendorOwnership | null;
    },
    enabled: isAuthenticated && !!vendorName,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
```

**Step 2: Create `VendorDashboard` shell**

Create `src/components/vendors/VendorDashboard.tsx`:

```typescript
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { BarChart2, MessageSquare, TrendingUp } from "lucide-react";

interface VendorDashboardProps {
  vendorName: string;
}

export function VendorDashboard({ vendorName }: VendorDashboardProps) {
  return (
    <div className="mb-8 border rounded-xl bg-card p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-5">
        <Badge variant="secondary" className="text-xs">Vendor Dashboard</Badge>
        <span className="text-xs text-muted-foreground">Only visible to you</span>
      </div>
      <Tabs defaultValue="overview">
        <TabsList className="mb-5">
          <TabsTrigger value="overview" className="flex items-center gap-1.5 text-sm">
            <BarChart2 className="h-3.5 w-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="respond" className="flex items-center gap-1.5 text-sm">
            <MessageSquare className="h-3.5 w-3.5" />
            Respond
          </TabsTrigger>
          <TabsTrigger value="intel" className="flex items-center gap-1.5 text-sm">
            <TrendingUp className="h-3.5 w-3.5" />
            Market Intel
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <p className="text-sm text-muted-foreground">Overview loading…</p>
        </TabsContent>
        <TabsContent value="respond">
          <p className="text-sm text-muted-foreground">Respond tab loading…</p>
        </TabsContent>
        <TabsContent value="intel">
          <p className="text-sm text-muted-foreground">Intel loading…</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

**Step 3: Inject `VendorDashboard` into `VendorProfile.tsx`**

Open `src/pages/VendorProfile.tsx`. Make three edits:

**Edit A — Add imports** (after the existing import block, around line 21):

```typescript
import { useVendorOwnership } from "@/hooks/useVendorOwnership";
import { VendorDashboard } from "@/components/vendors/VendorDashboard";
```

**Edit B — Add hook call** (after line 85, after `const isProUserValue = ...`):

```typescript
const { data: ownershipData } = useVendorOwnership(vendorName || undefined);
const isVendorOwner = !!ownershipData;
```

**Edit C — Render dashboard** (at line 459, as the FIRST child inside the main content div `<div className="max-w-7xl mx-auto...">`):

```tsx
{/* Vendor dashboard — only renders when verified owner is logged in */}
{isVendorOwner && <VendorDashboard vendorName={vendorName} />}
```

**Step 4: Test manually**

1. Run `npm run dev`
2. In Supabase, manually insert a test row:
   ```sql
   INSERT INTO vendor_profiles (user_id, vendor_name, is_approved)
   VALUES ('<your-clerk-user-id>', '<a-vendor-name>', true);
   ```
   Get your Clerk user ID from the Clerk dashboard or browser devtools (`user.id`).
3. Log in, navigate to `/vendors/<that-vendor-name>`
4. Confirm the "Vendor Dashboard" card with three tabs appears above the public profile
5. Log out — confirm dashboard is gone
6. Log in as a different user — confirm dashboard does NOT appear

**Step 5: Remove the test row**

```sql
DELETE FROM vendor_profiles WHERE vendor_name = '<your-test-vendor>';
```

**Step 6: Commit**

```bash
git add src/hooks/useVendorOwnership.ts \
        src/components/vendors/VendorDashboard.tsx \
        src/pages/VendorProfile.tsx
git commit -m "feat: add vendor ownership gate and dashboard shell"
```

---

## Task 3: Claim Profile Modal (V2)

**Files:**
- Create: `src/components/vendors/ClaimProfileModal.tsx`
- Modify: `src/pages/VendorProfile.tsx`

**Step 1: Create `ClaimProfileModal`**

Create `src/components/vendors/ClaimProfileModal.tsx`:

```typescript
import { useState } from "react";
import { useClerkAuth } from "@/hooks/useClerkAuth";
import { useClerkSupabase } from "@/hooks/useClerkSupabase";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface ClaimProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorName: string;
}

export function ClaimProfileModal({
  open, onOpenChange, vendorName,
}: ClaimProfileModalProps) {
  const { user } = useClerkAuth();
  const supabase = useClerkSupabase();

  const [name, setName] = useState(user?.fullName ?? "");
  const [email, setEmail] = useState(
    user?.primaryEmailAddress?.emailAddress ?? ""
  );
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("vendor_claims").insert({
        vendor_name: vendorName,
        claimant_name: name.trim(),
        claimant_email: email.trim(),
        note: note.trim() || null,
        claimant_user_id: user.id,
        status: "pending",
      });
      if (error) throw error;
      toast.success("Claim submitted — we'll review it shortly.");
      onOpenChange(false);
      setNote("");
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit claim. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Claim {vendorName}</DialogTitle>
          <DialogDescription>
            Submit a request to verify you represent this vendor.
            We review all claims manually before granting access.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="claim-name">Your name</Label>
            <Input
              id="claim-name"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="claim-email">Work email</Label>
            <Input
              id="claim-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="claim-note">Note <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea
              id="claim-note"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Anything that helps us verify your claim…"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit claim"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Add claim button + modal to `VendorProfile.tsx`**

**Edit A — Import** (add after existing imports):

```typescript
import { ClaimProfileModal } from "@/components/vendors/ClaimProfileModal";
```

**Edit B — State** (add near other `useState` calls, around line 68):

```typescript
const [claimModalOpen, setClaimModalOpen] = useState(false);
```

**Edit C — Button** (find the header section around line 460–500, inside the hero/vendor name area, add after the VendorDashboard block):

Show the button only when: user is authenticated AND is not already the owner.

```tsx
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

<ClaimProfileModal
  open={claimModalOpen}
  onOpenChange={setClaimModalOpen}
  vendorName={vendorName}
/>
```

**Step 3: Test manually**

1. Log in as a user who does NOT own any vendor profile
2. Navigate to any vendor profile page
3. Confirm "Claim this profile" button is visible
4. Click it, fill out the form (use a real name/email), submit
5. Check Supabase `vendor_claims` table — confirm row inserted with `status = 'pending'`
6. Confirm the modal closes and a success toast appears

**Step 4: Commit**

```bash
git add src/components/vendors/ClaimProfileModal.tsx \
        src/pages/VendorProfile.tsx
git commit -m "feat: add claim profile modal and button"
```

---

## Task 4: Admin Claims Page (V3)

**Files:**
- Create: `src/pages/admin/ClaimsPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/admin/AdminSidebar.tsx`

**Step 1: Create `ClaimsPage`**

Create `src/pages/admin/ClaimsPage.tsx`:

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useClerkSupabase } from "@/hooks/useClerkSupabase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle, XCircle } from "lucide-react";

interface VendorClaim {
  id: string;
  vendor_name: string;
  claimant_name: string;
  claimant_email: string;
  note: string | null;
  status: "pending" | "approved" | "rejected";
  claimant_user_id: string;
  created_at: string;
}

export default function ClaimsPage() {
  const supabase = useClerkSupabase();
  const queryClient = useQueryClient();

  const { data: claims = [], isLoading } = useQuery<VendorClaim[]>({
    queryKey: ["admin-vendor-claims"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_vendor_claims");
      if (error) throw error;
      return (data ?? []) as VendorClaim[];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({
      claimId,
      vendorName,
      claimantUserId,
    }: {
      claimId: string;
      vendorName: string;
      claimantUserId: string;
    }) => {
      const { error } = await supabase.rpc("approve_vendor_claim", {
        p_claim_id: claimId,
        p_vendor_name: vendorName,
        p_claimant_user_id: claimantUserId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Claim approved — vendor profile created.");
      queryClient.invalidateQueries({ queryKey: ["admin-vendor-claims"] });
    },
    onError: () => toast.error("Failed to approve claim."),
  });

  const rejectMutation = useMutation({
    mutationFn: async (claimId: string) => {
      const { error } = await supabase.rpc("reject_vendor_claim", {
        p_claim_id: claimId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Claim rejected.");
      queryClient.invalidateQueries({ queryKey: ["admin-vendor-claims"] });
    },
    onError: () => toast.error("Failed to reject claim."),
  });

  const pending = claims.filter(c => c.status === "pending");
  const resolved = claims.filter(c => c.status !== "pending");

  if (isLoading) {
    return (
      <div className="p-6 text-zinc-400 text-sm">Loading claims…</div>
    );
  }

  return (
    <div className="p-6 space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100">Vendor Claims</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Review and approve vendor ownership requests.
        </p>
      </div>

      {/* Pending */}
      <section>
        <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-3">
          Pending ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-zinc-500">No pending claims.</p>
        ) : (
          <div className="space-y-3">
            {pending.map(claim => (
              <div
                key={claim.id}
                className="border border-zinc-800 rounded-lg p-4 bg-zinc-900"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-0.5">
                    <p className="font-medium text-zinc-100">{claim.vendor_name}</p>
                    <p className="text-sm text-zinc-400">
                      {claim.claimant_name} · {claim.claimant_email}
                    </p>
                    {claim.note && (
                      <p className="text-sm text-zinc-500 italic">
                        "{claim.note}"
                      </p>
                    )}
                    <p className="text-xs text-zinc-600">
                      {new Date(claim.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-400 border-red-900 hover:bg-red-950"
                      onClick={() => rejectMutation.mutate(claim.id)}
                      disabled={rejectMutation.isPending}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      onClick={() =>
                        approveMutation.mutate({
                          claimId: claim.id,
                          vendorName: claim.vendor_name,
                          claimantUserId: claim.claimant_user_id,
                        })
                      }
                      disabled={approveMutation.isPending}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Resolved */}
      {resolved.length > 0 && (
        <section>
          <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-3">
            Resolved ({resolved.length})
          </h2>
          <div className="space-y-2">
            {resolved.map(claim => (
              <div
                key={claim.id}
                className="border border-zinc-800 rounded-lg px-4 py-2.5 bg-zinc-900 flex items-center justify-between"
              >
                <div>
                  <span className="text-sm font-medium text-zinc-200">
                    {claim.vendor_name}
                  </span>
                  <span className="text-xs text-zinc-500 ml-2">
                    {claim.claimant_name}
                  </span>
                </div>
                <Badge
                  variant={claim.status === "approved" ? "default" : "secondary"}
                  className="text-xs"
                >
                  {claim.status}
                </Badge>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
```

**Step 2: Register route in `App.tsx`**

**Edit A — Lazy import** (add after line 30, with the other admin lazy imports):

```typescript
const ClaimsPage = lazy(() => import("./pages/admin/ClaimsPage"));
```

**Edit B — Route** (add after the `debug` route at line 81, before the closing `</Route>`):

```tsx
<Route path="claims" element={<Suspense fallback={<AdminFallback />}><ClaimsPage /></Suspense>} />
```

**Step 3: Add nav item to `AdminSidebar.tsx`**

In `src/components/admin/AdminSidebar.tsx`:

**Edit A — Import** (add `BadgeCheck` to the existing lucide-react import on line 2):

```typescript
import {
  LayoutDashboard, ListChecks, MessageSquare, Radio,
  CalendarClock, FileText, Settings, ArrowLeft,
  Sparkles, Send, Users, TrendingUp, Bug, BadgeCheck,
} from "lucide-react";
```

**Edit B — Nav item** (add to `navItems` array after the `queue` entry):

```typescript
{ to: "/admin/claims", icon: BadgeCheck, label: "Claims" },
```

**Step 4: Test manually**

1. Log in as admin, navigate to `/admin/claims`
2. Confirm "Vendor Claims" page loads, "Claims" appears in sidebar
3. Submit a claim as a regular user (from Task 3), then return to admin view
4. Approve the claim — confirm a `vendor_profiles` row is created:
   ```sql
   SELECT * FROM vendor_profiles ORDER BY created_at DESC LIMIT 5;
   ```
5. Log in as the claiming user, navigate to their vendor's profile — confirm dashboard appears

**Step 5: Commit**

```bash
git add src/pages/admin/ClaimsPage.tsx \
        src/App.tsx \
        src/components/admin/AdminSidebar.tsx
git commit -m "feat: add admin claims page with approve/reject actions"
```

---

## Task 5: Respond Tab (V4)

**Files:**
- Modify: `src/components/vendors/VendorDashboard.tsx`
- Read first: `src/hooks/useVendorReviews.ts` and `src/components/vendors/VendorResponseSection.tsx` to understand existing data patterns

**Step 1: Read the existing response infrastructure**

Open `src/hooks/useVendorReviews.ts`. Note:
- What the hook accepts as params
- What shape of data it returns (especially the mentions/entries array)
- Whether it accepts a `vendorName` param

Open `src/components/vendors/VendorResponseSection.tsx`. Note:
- What props it accepts
- Whether it already shows a reply form or just displays existing responses

Open `src/hooks/useSupabaseVendorData.ts`. Search for `vendor_responses` or `submitVendorResponse` to find the insert function.

**Step 2: Build `VendorRespondTab`**

Add this component to `src/components/vendors/VendorDashboard.tsx` (above the `VendorDashboard` export):

The exact implementation depends on what you find in Step 1. The pattern to follow:

```typescript
// Add at top of file
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useClerkSupabase } from "@/hooks/useClerkSupabase";
import { useState } from "react";
import { toast } from "sonner";

function VendorRespondTab({ vendorName }: { vendorName: string }) {
  const supabase = useClerkSupabase();
  const queryClient = useQueryClient();
  const [replies, setReplies] = useState<Record<string, string>>({});

  // Fetch mentions for this vendor
  const { data: mentions = [] } = useQuery({
    queryKey: ["vendor-respond-mentions", vendorName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_mentions")
        .select("id, quote, sentiment, title, created_at")
        .eq("vendor_name", vendorName)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch existing responses
  const { data: existingResponses = [] } = useQuery({
    queryKey: ["vendor-respond-responses", vendorName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_responses")
        .select("mention_id, response_text, created_at")
        .eq("vendor_name", vendorName);
      if (error) throw error;
      return data ?? [];
    },
  });

  const respondedIds = new Set(existingResponses.map((r: any) => r.mention_id));

  const replyMutation = useMutation({
    mutationFn: async ({
      mentionId,
      responseText,
    }: {
      mentionId: string;
      responseText: string;
    }) => {
      const { error } = await supabase.from("vendor_responses").insert({
        mention_id: mentionId,
        vendor_name: vendorName,
        response_text: responseText,
      });
      if (error) throw error;
    },
    onSuccess: (_, { mentionId }) => {
      toast.success("Reply posted.");
      setReplies(prev => ({ ...prev, [mentionId]: "" }));
      queryClient.invalidateQueries({
        queryKey: ["vendor-respond-responses", vendorName],
      });
    },
    onError: () => toast.error("Failed to post reply."),
  });

  if (mentions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No mentions yet for {vendorName}.
      </p>
    );
  }

  return (
    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
      {mentions.map((mention: any) => {
        const hasReply = respondedIds.has(mention.id);
        return (
          <div
            key={mention.id}
            className="border rounded-lg p-4 text-sm space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-slate-700 italic">"{mention.quote}"</p>
              <span
                className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                  mention.sentiment === "positive"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {mention.sentiment}
              </span>
            </div>
            {hasReply ? (
              <p className="text-xs text-muted-foreground">✓ Already responded</p>
            ) : (
              <div className="flex gap-2">
                <textarea
                  className="flex-1 border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  rows={2}
                  placeholder="Write a response…"
                  value={replies[mention.id] ?? ""}
                  onChange={e =>
                    setReplies(prev => ({
                      ...prev,
                      [mention.id]: e.target.value,
                    }))
                  }
                />
                <button
                  className="shrink-0 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-md hover:opacity-90 disabled:opacity-50"
                  disabled={
                    !replies[mention.id]?.trim() || replyMutation.isPending
                  }
                  onClick={() =>
                    replyMutation.mutate({
                      mentionId: mention.id,
                      responseText: replies[mention.id].trim(),
                    })
                  }
                >
                  Post
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

> **Note:** If `vendor_responses` has a different schema than assumed above (e.g., different column names), adjust accordingly. Check `supabase/migrations/` for the exact `vendor_responses` table definition.

**Step 3: Replace placeholder in `VendorDashboard`**

In `VendorDashboard.tsx`, replace:

```tsx
<TabsContent value="respond">
  <p className="text-sm text-muted-foreground">Respond tab loading…</p>
</TabsContent>
```

With:

```tsx
<TabsContent value="respond">
  <VendorRespondTab vendorName={vendorName} />
</TabsContent>
```

**Step 4: Test manually**

1. As verified vendor owner, open your profile and click the Respond tab
2. Confirm mentions list appears
3. Type a reply and click Post
4. Verify row in `vendor_responses` table:
   ```sql
   SELECT * FROM vendor_responses ORDER BY created_at DESC LIMIT 5;
   ```
5. Confirm the mention now shows "✓ Already responded"

**Step 5: Commit**

```bash
git add src/components/vendors/VendorDashboard.tsx
git commit -m "feat: add respond tab with mention reply composer"
```

---

## Task 6: Market Intel Panel (V5)

**Files:**
- Create: `src/components/vendors/VendorIntelPanel.tsx`
- Modify: `src/components/vendors/VendorDashboard.tsx`

**Step 1: Verify existing RPC signatures**

Open `src/hooks/useSupabaseVendorData.ts`. Search for:
- `get_vendor_pulse_vendor_profile` — note the exact param name
- `get_compared_vendors` — note the exact param names and return shape

Adjust the RPC calls below if the names differ.

**Step 2: Create `VendorIntelPanel`**

Create `src/components/vendors/VendorIntelPanel.tsx`:

```typescript
import { useQuery } from "@tanstack/react-query";
import { useClerkSupabase } from "@/hooks/useClerkSupabase";
import { Badge } from "@/components/ui/badge";

interface VendorIntelPanelProps {
  vendorName: string;
}

interface ComparedVendor {
  vendor_name: string;
  mention_count: number;
  positive_percent: number;
  co_occurrence_count: number | null;
}

export function VendorIntelPanel({ vendorName }: VendorIntelPanelProps) {
  const supabase = useClerkSupabase();

  const { data: ownProfile } = useQuery({
    queryKey: ["intel-own-profile", vendorName],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_vendor_pulse_vendor_profile",
        { p_vendor_name: vendorName }
      );
      if (error) throw error;
      return data as {
        vendor_name: string;
        total_mentions: number;
        positive_count: number;
        warning_count: number;
      } | null;
    },
  });

  const { data: competitors = [] } = useQuery<ComparedVendor[]>({
    queryKey: ["intel-competitors", vendorName],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_compared_vendors", {
        p_vendor_name: vendorName,
        p_limit: 4,
      });
      if (error) throw error;
      return (data ?? []) as ComparedVendor[];
    },
  });

  if (!ownProfile) {
    return (
      <p className="text-sm text-muted-foreground">Loading intel…</p>
    );
  }

  const ownPositivePct =
    ownProfile.total_mentions > 0
      ? Math.round((ownProfile.positive_count / ownProfile.total_mentions) * 100)
      : 0;

  const rows = [
    {
      name: ownProfile.vendor_name,
      mentions: ownProfile.total_mentions,
      positivePct: ownPositivePct,
      isOwn: true,
    },
    ...competitors.map(c => ({
      name: c.vendor_name,
      mentions: c.mention_count,
      positivePct: Math.round(c.positive_percent ?? 0),
      isOwn: false,
    })),
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        How you compare to vendors dealers mention alongside you.
      </p>
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-xs uppercase tracking-wide text-muted-foreground">
                Vendor
              </th>
              <th className="text-right px-4 py-2.5 font-medium text-xs uppercase tracking-wide text-muted-foreground">
                Mentions
              </th>
              <th className="text-right px-4 py-2.5 font-medium text-xs uppercase tracking-wide text-muted-foreground">
                Positive %
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(row => (
              <tr
                key={row.name}
                className={row.isOwn ? "bg-primary/5 font-medium" : ""}
              >
                <td className="px-4 py-3 flex items-center gap-2">
                  {row.name}
                  {row.isOwn && (
                    <Badge variant="outline" className="text-xs py-0">
                      You
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                  {row.mentions}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  <span
                    className={
                      row.positivePct >= 70
                        ? "text-emerald-600"
                        : row.positivePct >= 50
                        ? "text-yellow-600"
                        : "text-red-500"
                    }
                  >
                    {row.positivePct}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**Step 3: Wire into `VendorDashboard`**

In `src/components/vendors/VendorDashboard.tsx`:

**Edit A — Import:**

```typescript
import { VendorIntelPanel } from "./VendorIntelPanel";
```

**Edit B — Replace placeholder:**

```tsx
<TabsContent value="intel">
  <VendorIntelPanel vendorName={vendorName} />
</TabsContent>
```

**Step 4: Test manually**

1. As vendor owner, click the Market Intel tab
2. Confirm your row appears with a "You" badge
3. Confirm competitor rows appear below
4. Verify the positive % colors are correct (green ≥70%, yellow 50–69%, red <50%)

**Step 5: Commit**

```bash
git add src/components/vendors/VendorIntelPanel.tsx \
        src/components/vendors/VendorDashboard.tsx
git commit -m "feat: add market intel panel with competitor comparison table"
```

---

## Task 7: Member Discovery CTAs (V6)

**Files:**
- Modify: `src/pages/VendorProfile.tsx`

**Step 1: Rename "Frequently Compared With"**

In `src/pages/VendorProfile.tsx`, at line 873, change:

```tsx
Frequently Compared With
```

To:

```tsx
Alternatives &amp; Competitors
```

And update the subtitle at line 876 from:

```tsx
Vendors dealers often evaluate alongside {profileData.vendorName}
```

To:

```tsx
Vendors dealers evaluate alongside {profileData.vendorName}
```

**Step 2: Add "See all [category] →" CTA**

At line 920 (after the closing `</div>` of the compared vendors grid, inside the `<section>`), add:

```tsx
{profileData.categories && profileData.categories.length > 0 && (
  <div className="mt-4 text-center">
    <Link
      to={`/vendors?category=${encodeURIComponent(profileData.categories[0])}`}
      className="text-sm text-primary hover:underline"
    >
      See all {profileData.categories[0]} vendors →
    </Link>
  </div>
)}
```

`Link` is already imported at line 3.

**Step 3: Test manually**

1. Navigate to any vendor profile that has compared vendors shown
2. Confirm section header says "Alternatives & Competitors"
3. Confirm "See all [category] vendors →" link appears below the grid
4. Click it — confirm it navigates to `/vendors?category=<category>` and the feed filters correctly

> If the category filter in `/vendors` doesn't respond to `?category=` query params yet, check `src/pages/VendorsV2.tsx` for how category filtering works and adjust the link format if needed.

**Step 4: Commit**

```bash
git add src/pages/VendorProfile.tsx
git commit -m "feat: rename compared vendors section and add category browse CTA"
```

---

## Task 8: Overview Tab — Real Data (V1 follow-up)

**Files:**
- Modify: `src/components/vendors/VendorDashboard.tsx`

Replace the Overview placeholder with real stats from the existing `get_vendor_pulse_vendor_profile` RPC.

**Step 1: Add `VendorOverviewTab` to `VendorDashboard.tsx`**

Add above the `VendorDashboard` export:

```typescript
function VendorOverviewTab({ vendorName }: { vendorName: string }) {
  const supabase = useClerkSupabase();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["vendor-overview", vendorName],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_vendor_pulse_vendor_profile",
        { p_vendor_name: vendorName }
      );
      if (error) throw error;
      return data as {
        vendor_name: string;
        total_mentions: number;
        positive_count: number;
        warning_count: number;
      } | null;
    },
  });

  if (isLoading || !profile) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  const positivePct =
    profile.total_mentions > 0
      ? Math.round((profile.positive_count / profile.total_mentions) * 100)
      : 0;

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="rounded-lg border p-4 text-center">
        <p className="text-2xl font-bold tabular-nums">
          {profile.total_mentions}
        </p>
        <p className="text-xs text-muted-foreground mt-1">Total mentions</p>
      </div>
      <div className="rounded-lg border p-4 text-center">
        <p className="text-2xl font-bold tabular-nums text-emerald-600">
          {positivePct}%
        </p>
        <p className="text-xs text-muted-foreground mt-1">Positive sentiment</p>
      </div>
      <div className="rounded-lg border p-4 text-center">
        <p className="text-2xl font-bold tabular-nums text-red-500">
          {profile.warning_count}
        </p>
        <p className="text-xs text-muted-foreground mt-1">Concerns flagged</p>
      </div>
    </div>
  );
}
```

**Step 2: Replace placeholder in `VendorDashboard`**

```tsx
<TabsContent value="overview">
  <VendorOverviewTab vendorName={vendorName} />
</TabsContent>
```

**Step 3: Test and commit**

1. Open Overview tab as verified vendor — confirm 3 stat cards appear with real data
2. Cross-check numbers against the public profile page stats

```bash
git add src/components/vendors/VendorDashboard.tsx
git commit -m "feat: wire real stats into vendor dashboard overview tab"
```

---

## Post-V1 Manual Steps Checklist (Admin)

After every vendor approval, the admin must complete these two steps manually:

**1. Approve in-app** (automated by Task 4):
- Go to `/admin/claims`, approve the claim
- This creates the `vendor_profiles` row and sets `is_approved = true`

**2. Update Clerk org metadata** (manual for V1):
- Open Clerk Dashboard → Users → find the claiming user
- Navigate to their organization (or create one if needed)
- Set the org's `publicMetadata`:
  ```json
  {
    "vendor": {
      "paid": true,
      "verified": true,
      "tier": "pro",
      "vendorNames": ["Exact Vendor Name Here"]
    }
  }
  ```
- This enables the existing `useVendorAuth`/`useVerifiedVendor` hooks for any features that depend on them

> This manual Clerk step will be automated in V2 when a backend edge function with the Clerk secret key is added.
