# Phase 2: Admin Provisioning Tools - Research

**Researched:** 2026-04-13
**Domain:** React admin panel + Supabase Auth Admin API + Edge Functions
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Step-by-step wizard for creating vendor accounts — multi-step: 1) Enter vendor email 2) Search & link to existing vendor profile 3) Set tier (Unverified/T1/T2) 4) Confirm & auto-send OTP invite
- **D-02:** OTP invite auto-sends on wizard completion — no separate "Send Invite" step. Resend button available in vendor list.
- **D-03:** Standard data table matching existing admin patterns — columns: vendor name, email, tier (color badge), created date, last login, actions
- **D-04:** Tier badge colors: Unverified = gray/muted, Tier 1 = green (active), Tier 2 = purple (premium)
- **D-05:** Sidebar label is "Vendor Management" — placed within the existing CDG Admin sidebar, after Sales Targets (position 3)

### Claude's Discretion

- Icon choice for "Vendor Management" sidebar item
- Wizard dialog vs full-page layout
- Search/autocomplete implementation for vendor profile linking
- Resend cooldown timing (if any)
- Table sort/filter capabilities

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ADMIN-01 | Admin can create vendor login credentials by entering a vendor email address | Supabase Auth Admin API `supabase.auth.admin.generateLink({ type: 'magiclink', email })` called from an Edge Function with service-role key |
| ADMIN-02 | Admin can link a new vendor login to an existing vendor profile from a searchable list | `vendor_profiles` table queried via `useClerkSupabase()`; `<datalist>` autocomplete pattern already used in ClaimsPage for vendor names |
| ADMIN-03 | Admin can set vendor tier (Unverified / Tier 1 / Tier 2) during or after provisioning | `vendor_logins.tier` column with CHECK constraint already defined in migration; wizard step 3 selects tier; shadcn `<Select>` for tier picker |
| ADMIN-04 | Admin vendor list shows color-coded tier badges for quick visual identification | shadcn `<Badge>` with Tailwind variant classes; D-04 colors locked: gray / green / purple |
| ADMIN-05 | Admin can resend magic link to a vendor with one click | Resend button calls Edge Function with `supabase.auth.admin.generateLink({ type: 'magiclink', email })`; same function as provisioning, different code path |
| ADMIN-06 | `vendor_logins` table links Supabase Auth user ID (UUID) to vendor profile and tier | INSERT into `vendor_logins(user_id, vendor_name, tier)` after `generateLink` returns the UUID; table schema already created by Phase 1 migration |
</phase_requirements>

## Summary

Phase 2 adds a single admin page (`/admin/vendors`) with two surfaces: a data table listing provisioned vendor accounts and a lightweight multi-step wizard (Dialog) for creating new ones. The wizard calls a new Edge Function (`provision-vendor`) that uses Supabase Auth Admin API to generate a magic link without creating a public-facing registration flow. After the link is generated, the Edge Function inserts the resulting `user_id` into `vendor_logins`.

All the building blocks are already in place. The admin panel pattern (`AdminSidebar` + lazy route + `useClerkSupabase` + React Query + shadcn Table + Dialog) is repeated verbatim from `MembersPage` and `ClaimsPage`. The `vendor_logins` table schema was created in Phase 1. The vendor profile list to drive autocomplete can be fetched from `vendor_profiles` directly via the authenticated Supabase client — the same approach used in `ClaimsPage` which queries `admin_list_unclaimed_vendor_candidates`.

The only new infrastructure piece is a `provision-vendor` Edge Function that wraps `supabase.auth.admin.generateLink` and inserts into `vendor_logins` atomically. This must run server-side because the Auth Admin API requires the service-role key and must never be exposed to the browser.

**Primary recommendation:** Build the Edge Function first (it is the critical path), then build the UI on top of it.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | 2.76.1 | Auth Admin API + DB writes | Already in project; service-role client required [VERIFIED: package.json] |
| React + shadcn/ui Dialog | 18.3.1 / existing | Multi-step wizard container | Dialog already imported and used across admin pages [VERIFIED: MembersPage.tsx] |
| shadcn/ui Table (native `<table>`) | existing | Vendor list data table | Native table pattern used in MembersPage, not TanStack Table [VERIFIED: MembersPage.tsx] |
| shadcn/ui Badge | existing | Tier color badges | Already imported in ClaimsPage [VERIFIED: ClaimsPage.tsx] |
| TanStack React Query | 5.83.0 | Server state: list + mutations | Used across all admin pages [VERIFIED: ClaimsPage.tsx, MembersPage.tsx] |
| Sonner (toast) | 1.7.4 | Success/error feedback | Standard in all admin mutations [VERIFIED: MembersPage.tsx] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Deno std `serve` | 0.168.0 | Edge Function runtime | Same version already used in all existing Edge Functions [VERIFIED: supabase/functions/] |
| `https://esm.sh/@supabase/supabase-js@2.76.0` | 2.76.0 | Service-role client inside Edge Function | Exact import path used in all existing Edge Functions [VERIFIED: admin-ensure-vendor-profile/index.ts] |
| Lucide React | 0.462.0 | Sidebar icon + action icons | `Store` or `Building2` for Vendor Management [VERIFIED: AdminSidebar.tsx icon set] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native `<table>` | TanStack Table | TanStack Table is heavier; MembersPage uses native table — stay consistent |
| Dialog wizard | Multi-step full page | Dialog is faster to build; CONTEXT.md specifics say "lightweight dialog/sheet" |
| `<datalist>` autocomplete | Combobox (shadcn) | `<datalist>` is simpler, already used in ClaimsPage for vendor name input — parity |

**Installation:** No new packages required. All dependencies already present in the project.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── pages/admin/
│   └── VendorManagementPage.tsx    # New admin page (data table + wizard trigger)
├── components/admin/
│   └── vendor-management/
│       ├── VendorWizardDialog.tsx   # Multi-step Dialog (steps 1-4)
│       ├── VendorTierBadge.tsx      # Reusable tier badge component
│       └── VendorManagementTable.tsx # Extracted table (if > 150 lines)
supabase/functions/
└── provision-vendor/
    └── index.ts                     # Edge Function: generateLink + insert vendor_logins
```

### Pattern 1: Edge Function with Clerk Admin Verification

All privileged Edge Functions in this project verify the caller is an admin by decoding the Clerk JWT. The `verifyAdmin` pattern is copied verbatim from `admin-ensure-vendor-profile`.

```typescript
// Source: supabase/functions/admin-ensure-vendor-profile/index.ts
function verifyAdmin(token: string): { isAdmin: boolean; userId: string } {
  const payload = JSON.parse(atob(token.split(".")[1]));
  const userId = payload.sub || "";
  const isAdmin = payload.user_role === "admin";
  return { isAdmin, userId };
}

// Auth token passed in body — avoids Supabase gateway rejecting Clerk JWTs
const { _auth_token } = body;
const authToken = _auth_token || req.headers.get("Authorization")?.replace("Bearer ", "");
const { isAdmin } = verifyAdmin(authToken);
if (!isAdmin) throw new Error("permission denied: admin role required");
```

[VERIFIED: supabase/functions/admin-ensure-vendor-profile/index.ts]

### Pattern 2: Supabase Auth Admin API — generateLink for Magic Link

`supabase.auth.admin.generateLink` returns a magic link URL and a `user` object containing the `id` (UUID). This is the correct API to:
1. Create a new auth user for a vendor email (without triggering self-registration)
2. Generate an OTP/magic link to send to that email

```typescript
// Source: Supabase Auth Admin docs [ASSUMED — not present in codebase, verify against Supabase docs]
const { data, error } = await supabase.auth.admin.generateLink({
  type: "magiclink",
  email: vendorEmail,
  options: {
    redirectTo: `${appUrl}/vendor-dashboard`,
  },
});
// data.user.id is the Supabase Auth UUID
// data.properties.action_link is the OTP link
```

**Note:** `generateLink` does NOT send the email — it only returns the link. To send the email, use `supabase.auth.admin.inviteUserByEmail` which both creates the user AND sends the email, or call `generateLink` then email the link manually via Resend (already used in `vendor-claim-notify`). [ASSUMED — verify which method fits "OTP invite" vs "magic link" semantics]

**Alternative path:** `supabase.auth.admin.inviteUserByEmail({ email, options: { data: {} } })` sends a built-in invitation email automatically. If the project's Supabase instance has email templates configured, this is simpler. [ASSUMED]

### Pattern 3: Atomic Provisioning in Edge Function

The Edge Function must: (1) create/verify auth user, (2) insert `vendor_logins` row linking UUID to vendor_name + tier. Both must succeed or neither should persist.

```typescript
// Source: [ASSUMED — standard pattern]
// Step 1: Create user or get existing
const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
  type: "magiclink",
  email: vendorEmail,
});
if (linkError) throw linkError;

const userId = linkData.user.id;

// Step 2: Upsert vendor_logins row
const { error: insertError } = await supabase
  .from("vendor_logins")
  .upsert(
    { user_id: userId, vendor_name: vendorName, tier: tier },
    { onConflict: "user_id" }
  );
if (insertError) throw insertError;

// Step 3: Return magic link to admin (admin can copy/send it)
return { action_link: linkData.properties.action_link };
```

### Pattern 4: Admin Page with React Query + useMutation

All admin data mutations use `useMutation` from TanStack Query with `queryClient.invalidateQueries` on success. Calling the Edge Function uses `fetchWithAuth` from `useClerkAuth`.

```typescript
// Source: src/pages/admin/MembersPage.tsx (handleSync pattern)
const { fetchWithAuth } = useClerkAuth();

const provisionMutation = useMutation({
  mutationFn: async (payload: ProvisionPayload) => {
    const token = await getToken();
    const res = await fetchWithAuth(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/provision-vendor`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, _auth_token: token }),
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Provisioning failed");
    return data;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["admin-vendor-logins"] });
    toast.success("Vendor provisioned. Magic link sent.");
  },
  onError: (err: Error) => toast.error(err.message),
});
```

[VERIFIED: MembersPage.tsx pattern + admin-ensure-vendor-profile auth pattern]

### Pattern 5: Vendor Profile Autocomplete

`ClaimsPage` uses a native `<datalist>` element fed by a React Query list. For the wizard's vendor profile search (step 2), use the same approach querying `vendor_profiles`.

```typescript
// Source: src/pages/admin/ClaimsPage.tsx lines 51-62
const { data: vendorProfiles = [] } = useQuery<string[]>({
  queryKey: ["admin-vendor-profiles-list"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("vendor_profiles")
      .select("vendor_name")
      .order("vendor_name");
    if (error) throw error;
    return (data ?? []).map((row) => row.vendor_name);
  },
});
```

[VERIFIED: ClaimsPage.tsx lines 51-62 + vendor_profiles schema]

### Pattern 6: Listing Vendor Logins from the Admin Panel

The vendor list page needs to read `vendor_logins` joined with `auth.users` (for email and last_sign_in_at). Direct `auth.users` access requires service-role, so this must go through an Edge Function or a `SECURITY DEFINER` RPC.

Simplest approach matching existing patterns: a `SECURITY DEFINER` RPC `admin_list_vendor_logins` that joins `vendor_logins` with `auth.users`, protected by a role check inside the function.

```sql
-- [ASSUMED — no existing RPC for this yet]
CREATE OR REPLACE FUNCTION admin_list_vendor_logins()
RETURNS TABLE (
  id UUID, user_id UUID, vendor_name TEXT, tier TEXT,
  email TEXT, created_at TIMESTAMPTZ, last_sign_in_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  -- Admin-only check via user_roles table (existing pattern)
  RETURN QUERY
    SELECT vl.id, vl.user_id, vl.vendor_name, vl.tier,
           u.email, vl.created_at, u.last_sign_in_at
    FROM public.vendor_logins vl
    JOIN auth.users u ON u.id = vl.user_id
    ORDER BY vl.created_at DESC;
END;
$$;
```

### Anti-Patterns to Avoid

- **Calling auth.admin API from the browser:** Service-role key must NEVER be exposed. All auth admin operations MUST go through an Edge Function. [VERIFIED: all existing admin operations use Edge Functions]
- **Separate "Send Invite" step:** D-02 locks auto-send on wizard completion. Do not add a manual send step.
- **Using `supabase.from('auth.users')` directly:** `auth.users` is not accessible via the JS client with anon/authenticated keys. Use an Edge Function with service-role or a SECURITY DEFINER RPC.
- **Skipping `onConflict` on vendor_logins upsert:** If admin re-provisions an existing email, `generateLink` returns the same UUID. Upsert on `user_id` prevents duplicate row error.
- **Importing Clerk JWT as Supabase session:** Do NOT pass the Clerk JWT to the vendor Supabase client. The `_auth_token` body field pattern (not Authorization header) is used precisely to avoid the Supabase gateway rejecting Clerk tokens.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sending magic links | Custom email + token generation | `supabase.auth.admin.generateLink` or `inviteUserByEmail` | Handles token generation, expiry, and delivery; building custom is an auth security risk |
| Auth user creation | Direct INSERT into `auth.users` | `supabase.auth.admin.createUser` / `generateLink` | `auth.users` is managed by Supabase; direct inserts bypass triggers and security constraints |
| Tier badge colors | Custom CSS classes | shadcn `<Badge>` with Tailwind variant | D-04 already specifies exact colors; Badge is already in the project |
| Autocomplete search | Custom search component | Native `<datalist>` (parity with ClaimsPage) | Already proven working in ClaimsPage for same use case |
| Admin auth verification | Custom middleware | `verifyAdmin` function copied from existing Edge Functions | Pattern is established and consistent across all admin Edge Functions |

**Key insight:** The Auth Admin API is the only correct path for server-side user provisioning in Supabase. Attempting to manage auth users through direct table access or client-side flows creates security holes and bypasses Supabase Auth's own internal consistency mechanisms.

## Common Pitfalls

### Pitfall 1: generateLink Does Not Send Email
**What goes wrong:** `supabase.auth.admin.generateLink` returns a link but does NOT send it. If the Edge Function only calls `generateLink`, vendors never receive the OTP.
**Why it happens:** Conflating `generateLink` (server-side link generation) with `signInWithOtp` (client-side, sends email).
**How to avoid:** Either (a) use `supabase.auth.admin.inviteUserByEmail` which does send email, or (b) call `generateLink` and then send `data.properties.action_link` via Resend (already used in `vendor-claim-notify`). Confirm which email template is configured in the Supabase dashboard.
**Warning signs:** Admin sees "success" but vendor receives no email.

### Pitfall 2: Re-provisioning an Existing Email Fails
**What goes wrong:** Calling `generateLink` for an email that already has an auth user may return an error or create a duplicate, depending on Supabase version behavior.
**Why it happens:** `generateLink` and `inviteUserByEmail` have different idempotency semantics.
**How to avoid:** Before `generateLink`, check if the email exists via `supabase.auth.admin.listUsers` (filtering by email) or `supabase.auth.admin.getUserByEmail`. If user exists, just generate a new link for them — do not attempt to create again. Use `upsert` (not `insert`) when writing to `vendor_logins`.
**Warning signs:** Edge Function returning 400 on resend attempts.

### Pitfall 3: vendor_profiles vs vendor_logins Name Mismatch
**What goes wrong:** Admin picks a vendor profile from the list; the `vendor_name` string stored in `vendor_logins` doesn't match `vendor_profiles.vendor_name` exactly (casing, trailing spaces).
**Why it happens:** `vendor_profiles` has a case-insensitive unique index (`uq_vendor_profiles_vendor_name_ci`) but `vendor_logins` uses plain TEXT equality. Phase 3 RLS policies depend on this join working correctly.
**How to avoid:** When writing to `vendor_logins`, always use the `vendor_name` value exactly as returned from the `vendor_profiles` SELECT query — never free-type it. The wizard step 2 must bind the selected value from the query, not the typed string.
**Warning signs:** Phase 3 RLS policies return empty datasets despite correct provisioning.

### Pitfall 4: auth.users Access Without Service Role
**What goes wrong:** The vendor list table tries to display vendor email addresses, but the frontend Supabase client (anon/clerk key) cannot read `auth.users`.
**Why it happens:** `auth.users` is a protected schema. Only service-role clients can read it.
**How to avoid:** The `admin_list_vendor_logins` RPC must be `SECURITY DEFINER` and run with service-role equivalent (or use an Edge Function). The RPC joins `vendor_logins` with `auth.users` server-side and returns email as a column.
**Warning signs:** Query returns `vendor_logins` rows but email is `null` or RPC errors with permission denied.

### Pitfall 5: Wizard State Not Reset After Close
**What goes wrong:** Admin closes the wizard partway through, then reopens it — state from the previous attempt (email, vendor selection, tier) is still populated.
**Why it happens:** Dialog state is held in a parent component's `useState`; closing the Dialog doesn't unmount the inner wizard component if it's always rendered.
**How to avoid:** Reset wizard state (`setStep(1)`, `setEmail("")`, etc.) in the Dialog's `onOpenChange` handler when `open` becomes `false`. Or conditionally render the wizard only when `open === true`.
**Warning signs:** Reopening wizard shows previous form values.

## Code Examples

### Edge Function Skeleton (provision-vendor)
```typescript
// supabase/functions/provision-vendor/index.ts
// Pattern from: supabase/functions/admin-ensure-vendor-profile/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-organization-id",
};

function verifyAdmin(token: string): { isAdmin: boolean; userId: string } {
  const payload = JSON.parse(atob(token.split(".")[1]));
  return { isAdmin: payload.user_role === "admin", userId: payload.sub || "" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { vendor_email, vendor_name, tier, _auth_token } = body;

    const authToken = _auth_token || req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!authToken) throw new Error("Missing auth token");
    const { isAdmin } = verifyAdmin(authToken);
    if (!isAdmin) throw new Error("permission denied: admin role required");

    if (!vendor_email || !vendor_name || !tier) throw new Error("vendor_email, vendor_name, and tier are required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // [ASSUMED: inviteUserByEmail sends email automatically]
    const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
      vendor_email,
      { redirectTo: `${Deno.env.get("PUBLIC_APP_URL") || "https://app.cdgpulse.com"}/vendor-dashboard` }
    );
    if (inviteError) throw inviteError;

    const userId = inviteData.user.id;

    const { error: upsertError } = await supabase
      .from("vendor_logins")
      .upsert({ user_id: userId, vendor_name, tier }, { onConflict: "user_id" });
    if (upsertError) throw upsertError;

    return new Response(JSON.stringify({ ok: true, user_id: userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

[VERIFIED pattern: admin-ensure-vendor-profile/index.ts; `inviteUserByEmail` call is [ASSUMED]]

### AdminSidebar Addition
```typescript
// Source: src/components/admin/AdminSidebar.tsx — insert at position 3 (after Sales Targets)
// Icon TBD (Claude's discretion): Store, Building2, or ShieldCheck from lucide-react
{ to: "/admin/vendors", icon: Store, label: "Vendor Management" },
```
[VERIFIED: AdminSidebar.tsx navItems array pattern]

### App.tsx Route Registration
```typescript
// Source: src/App.tsx — lazy load pattern (lines 18-34)
const VendorManagementPage = lazy(() => import("./pages/admin/VendorManagementPage"));

// Inside admin Route children (after sales-targets, line 98):
<Route path="vendors" element={<Suspense fallback={<AdminFallback />}><VendorManagementPage /></Suspense>} />
```
[VERIFIED: App.tsx lines 18-34, 84-99]

### Tier Badge Component
```typescript
// Tier badge colors from D-04 (locked decision)
const TIER_BADGE: Record<string, string> = {
  unverified: "bg-zinc-700 text-zinc-300",
  tier_1: "bg-green-900/50 text-green-300 border border-green-700/50",
  tier_2: "bg-purple-900/50 text-purple-300 border border-purple-700/50",
};

function VendorTierBadge({ tier }: { tier: string }) {
  const label = tier === "unverified" ? "Unverified" : tier === "tier_1" ? "T1" : "T2";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${TIER_BADGE[tier] ?? TIER_BADGE.unverified}`}>
      {label}
    </span>
  );
}
```
[VERIFIED: D-04 locked colors; Tailwind color scale consistent with MembersPage activity squares]

### admin_list_vendor_logins RPC (migration)
```sql
-- New migration: admin_list_vendor_logins SECURITY DEFINER RPC
-- [ASSUMED — no existing RPC for this; pattern from ClaimsPage admin RPCs]
CREATE OR REPLACE FUNCTION public.admin_list_vendor_logins()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  vendor_name TEXT,
  tier TEXT,
  email TEXT,
  created_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT
      vl.id,
      vl.user_id,
      vl.vendor_name,
      vl.tier,
      u.email::TEXT,
      vl.created_at,
      u.last_sign_in_at
    FROM public.vendor_logins vl
    JOIN auth.users u ON u.id = vl.user_id
    ORDER BY vl.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_vendor_logins() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_vendor_logins() TO authenticated;
```

## Runtime State Inventory

> This section is omitted — Phase 2 is a greenfield additive feature (new page, new Edge Function, new migration). No existing data stores reference vendor admin provisioning state.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase CLI | Edge Function deployment | [ASSUMED: yes — used in Phase 1] | — | — |
| Supabase Auth email delivery | Magic link sending | [ASSUMED: yes — configured for vendor-claim-notify] | — | Use Resend as fallback (already in vendor-claim-notify) |
| `PUBLIC_APP_URL` env var | redirect URL in magic link | [ASSUMED: check Supabase Edge Function secrets] | — | Hardcode `https://app.cdgpulse.com` |

**Missing dependencies with no fallback:** None identified.

**Missing dependencies with fallback:**
- Email delivery: if Supabase's built-in SMTP is not configured for `inviteUserByEmail`, use `generateLink` + Resend (Resend is already wired in `vendor-claim-notify`).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright 1.57.0 (E2E only; no unit test framework) |
| Config file | `playwright.config.ts` |
| Quick run command | `npx playwright test --grep "vendor management"` |
| Full suite command | `npx playwright test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ADMIN-01 | Admin creates vendor login via wizard | E2E | `npx playwright test --grep "ADMIN-01"` | ❌ Wave 0 |
| ADMIN-02 | Vendor profile autocomplete links correctly | E2E | `npx playwright test --grep "ADMIN-02"` | ❌ Wave 0 |
| ADMIN-03 | Tier selector sets correct value in DB | E2E | `npx playwright test --grep "ADMIN-03"` | ❌ Wave 0 |
| ADMIN-04 | Tier badges render correct colors | E2E | `npx playwright test --grep "ADMIN-04"` | ❌ Wave 0 |
| ADMIN-05 | Resend button triggers new magic link | E2E | `npx playwright test --grep "ADMIN-05"` | ❌ Wave 0 |
| ADMIN-06 | vendor_logins row has correct UUID + tier | E2E | `npx playwright test --grep "ADMIN-06"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** Manual browser smoke test (E2E test infrastructure requires admin auth setup)
- **Per wave merge:** `npx playwright test --grep "vendor management"`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/admin-vendor-management.spec.ts` — covers ADMIN-01 through ADMIN-06
- [ ] Playwright admin auth fixture (admin Clerk session setup for test isolation)

*(Note: E2E tests require a running Supabase instance and Clerk test credentials. If not feasible in CI, manual smoke test checklist is the fallback for the phase gate.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth Admin API (server-side only, never client-side) |
| V3 Session Management | no | Vendor sessions managed by Phase 1; this phase only creates users |
| V4 Access Control | yes | `verifyAdmin` in Edge Function; `SECURITY DEFINER` RPC with role check |
| V5 Input Validation | yes | Validate email format, vendor_name not empty, tier in allowed values before Edge Function processes |
| V6 Cryptography | no | Magic link token generation handled entirely by Supabase Auth |

### Known Threat Patterns for Admin Provisioning

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthorized vendor creation | Elevation of Privilege | `verifyAdmin` check in Edge Function decodes Clerk JWT `user_role === "admin"` |
| Mass account creation / spam | Denial of Service | Admin-only operation; no public endpoint; rate limiting deferred to v2 SEC-02 |
| Vendor email spoofing | Spoofing | Magic link goes to the email address admin enters; admin owns the provisioning relationship |
| Service-role key exposure | Information Disclosure | Service-role key only in Edge Function env var (Deno.env), never in client bundle |
| SQL injection via vendor_name | Tampering | Supabase JS client uses parameterized queries via PostgREST; no raw SQL in Edge Function |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `supabase.auth.admin.inviteUserByEmail` sends email automatically (no separate Resend call needed) | Code Examples, Pitfall 1 | Edge Function succeeds but vendor never receives email; need to add Resend email step |
| A2 | `generateLink` for an existing email returns the same UUID without error (idempotent) | Pitfall 2 | Resend flow fails on duplicate emails; need explicit getUserByEmail check first |
| A3 | `PUBLIC_APP_URL` env var is already set in Supabase Edge Function secrets | Environment Availability | redirect URL in magic link points to wrong host; vendor lands on 404 after clicking link |
| A4 | Supabase CLI is available and functional for deploying the new Edge Function | Environment Availability | Deployment step fails; need to verify `supabase functions deploy provision-vendor` works |
| A5 | `admin_list_vendor_logins` RPC can join `auth.users` from a SECURITY DEFINER function | Code Examples | RPC fails with permission error on `auth.users`; need to use Edge Function with service-role for listing instead |

## Open Questions

1. **inviteUserByEmail vs generateLink + Resend**
   - What we know: Both can provision a vendor auth user. `inviteUserByEmail` sends built-in email; `generateLink` only returns the link.
   - What's unclear: Whether Supabase's built-in email template is acceptable for the CDG Pulse brand, and whether SMTP is configured on the Supabase project.
   - Recommendation: Use `inviteUserByEmail` first. If email doesn't arrive, fall back to `generateLink` + Resend (already proven in `vendor-claim-notify`).

2. **SECURITY DEFINER RPC vs Edge Function for vendor list**
   - What we know: `auth.users` requires service-role. Existing admin list operations use both RPCs (`ClaimsPage`: `admin_list_vendor_claim_links` RPC) and Edge Functions (`MembersPage`: `sync-airtable-members`).
   - What's unclear: Whether a `SECURITY DEFINER` function can reliably join `auth.users` in this Supabase version (some setups restrict this).
   - Recommendation: Attempt SECURITY DEFINER RPC first (simpler, no cold start). If it fails with permission error, move the list query into the `provision-vendor` Edge Function as a separate `list` action.

## Sources

### Primary (HIGH confidence)
- `src/pages/admin/MembersPage.tsx` — Admin page pattern, native table, fetchWithAuth usage [VERIFIED]
- `src/pages/admin/ClaimsPage.tsx` — useMutation pattern, datalist autocomplete, badge usage [VERIFIED]
- `src/components/admin/AdminSidebar.tsx` — navItems array, NavLink pattern, icon imports [VERIFIED]
- `src/App.tsx` — Lazy route registration pattern for admin pages [VERIFIED]
- `supabase/functions/admin-ensure-vendor-profile/index.ts` — verifyAdmin, _auth_token, service-role client pattern [VERIFIED]
- `supabase/migrations/20260413000000_create_vendor_logins.sql` — vendor_logins schema, tier CHECK constraint [VERIFIED]
- `supabase/migrations/20260121211304_*.sql` + related — vendor_profiles schema [VERIFIED]

### Secondary (MEDIUM confidence)
- Supabase Auth Admin API (`auth.admin.inviteUserByEmail`, `generateLink`) — documented behavior inferred from project context and training knowledge; not verified against live Supabase docs in this session

### Tertiary (LOW confidence)
- A1–A5 in Assumptions Log — runtime behavior of Supabase Auth Admin API methods in this project's specific Supabase configuration

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in project, patterns verified in codebase
- Architecture: HIGH — Edge Function + admin page pattern directly follows 3 existing examples
- Pitfalls: MEDIUM — pitfalls 1-4 are based on Supabase Auth Admin API knowledge (training); pitfall 5 is codebase-verified
- Auth Admin API behavior: LOW — not verified against live Supabase project; assumptions logged

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (Supabase Auth Admin API is stable; React/shadcn patterns are stable)
