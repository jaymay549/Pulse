# Architecture

**Analysis Date:** 2026-04-13

## Pattern Overview

**Overall:** Multi-backend SaaS with role-based access control (RBAC) and tier-gated feature access

**Key Characteristics:**
- Dual-backend architecture: Supabase PostgreSQL for RLS-protected app data, WAM API (Railway) for WhatsApp/AI pipeline
- Clerk-managed authentication with JWT tokens passed to both backends
- Tier-based access control: free → pro → executive, with vendor-org access as alternative
- Lazy-loaded admin routes with AdminGuard protection
- React Query for server-side state, React Router for navigation
- Supabase Edge Functions for AI-driven vendor intelligence generation

## Layers

**Presentation (React Components):**
- Purpose: UI rendering, user interaction, form handling
- Location: `src/components/` and `src/pages/`
- Contains: Functional components using shadcn/ui + Tailwind, page containers, modals, filters, charts (Recharts)
- Depends on: Custom hooks, utilities, shadcn primitives, Radix UI
- Used by: Browser; rendered by React

**State Management (Custom Hooks + React Query):**
- Purpose: Server-side data fetching, caching, synchronization with backends
- Location: `src/hooks/` (20+ hooks)
- Contains: `useClerkAuth()`, `useClerkSupabase()`, `useWamApi()`, `useVendorFilters()`, `useSupabaseVendorData()`, etc.
- Depends on: Clerk SDK, Supabase client, axios/fetch, React Query
- Used by: All components that need data

**Authentication & Authorization:**
- Purpose: Identity verification, tier determination, role assignment
- Location: `src/hooks/useClerkAuth.ts`, `src/hooks/useClerkSupabase.ts`, `src/utils/tierUtils.ts`, `src/utils/accessControl.ts`
- Contains: Tier enums (free/pro/executive/community), metadata resolution, Supabase RLS token assembly
- Depends on: Clerk SDK, Supabase client
- Used by: All pages and hooks requiring auth or permission checks

**Backend Integration:**
- Purpose: Communication with Supabase (RLS-protected) and WAM API (WhatsApp/AI)
- Location: `src/integrations/supabase/`, `src/config/wam.ts`, `src/hooks/useWamApi.ts`, `src/hooks/useSupabaseVendorData.ts`
- Contains: Supabase client factory, WAM API wrapper, auto-generated TypeScript types, Edge Function calls
- Depends on: Supabase JS SDK, fetch API, environment variables
- Used by: All data-fetching hooks and components

**Utilities & Shared Logic:**
- Purpose: Helper functions, tier checking, access control, markdown rendering
- Location: `src/utils/`, `src/lib/`
- Contains: `tierUtils.ts` (access level checks), `accessControl.ts` (unified vendor permission resolver), `markdown.tsx`, `vendorPortalApi.ts`
- Depends on: Types
- Used by: Components and hooks

**Types & Constants:**
- Purpose: TypeScript definitions, enums, configuration
- Location: `src/types/`, `src/constants/`, `src/integrations/supabase/types.ts`
- Contains: Auto-generated Supabase schema types, admin types, vendor types
- Depends on: None (leaf layer)
- Used by: All other layers

## Data Flow

**User Login & Authentication:**

1. User navigates to `/` → redirects to `/vendors`
2. `main.tsx` wraps app with `ClerkProvider` (detects environment for Clerk key)
3. `App.tsx` provides `QueryClientProvider`, `BrowserRouter`, `TooltipProvider`, `HelmetProvider`
4. `useClerkAuth()` hook resolves tier from `user.publicMetadata.circles.tier`
5. Tier stored in memory; used by components to gate features

**Vendor Data Fetch (RLS-Protected):**

1. Component calls `fetchVendorPulseFeed()` or similar from `src/hooks/useSupabaseVendorData.ts`
2. Function uses `supabase` client (anon key with localStorage session) or `useClerkSupabase()` (Clerk JWT-enhanced client)
3. Supabase RLS policies inspect JWT claims: `auth.jwt() ->> 'user_tier'` and compare against row-level vendor access
4. Positive results cached in React Query; component renders vendor mentions, themes, trends
5. Tier affects visibility: free users see redacted mentions, pro users see full data

**Admin Operations (WAM API):**

1. Admin navigates to `/admin/*` → `AdminGuard` checks `isAdmin` flag from Clerk metadata
2. Admin performs action (e.g., process queue, send message) via component button
3. Component calls `useWamApi()` hook method (e.g., `processQueueItem()`)
4. Hook sends `X-Password` header with value from `sessionStorage.getItem("wam_password")`
5. WAM API (Railway backend) processes request: WhatsApp API calls, Gemini AI, direct Postgres writes
6. Response returned; component updates local state or React Query cache

**Vendor Organization Access (Clerk Org Scoping):**

1. Vendor user belongs to Clerk organization
2. `useClerkAuth()` calls `getToken({ organizationId: org.id })` → Clerk includes `org_id` in JWT
3. Token passed to Supabase via `useClerkSupabase()`
4. RLS policy checks both `user_tier` AND `org_id` → allows vendor to modify their own responses
5. Alternatively, Supabase auth schema or app schema RLS columns guard vendor-specific data

**Edge Function Pipeline (Asynchronous):**

1. Data enters system (e.g., vendor mention from WhatsApp pipeline via wam schema)
2. Supabase migration or WAM backend writes to `wam.vendor_processing_queue`
3. Edge Function (`supabase/functions/generate-vendor-intelligence/`) runs on trigger
4. Function queries `wam` schema data, calls Gemini API, writes results to `public` schema tables
5. Client polls Supabase RLS view or reactive subscriptions get new data
6. Cache invalidated in React Query; UI re-renders

**State Management:**

- Server state: React Query caches Supabase/WAM responses (5-min default TTL)
- Client state: Component-local via `useState()` (filters, modal open/close, selections)
- Session state: Clerk session in browser memory; Supabase session in localStorage
- Admin session: WAM password stored in sessionStorage (not persisted)

## Key Abstractions

**Tier System:**
- Purpose: Unified permission framework across frontend and backend
- Examples: `src/utils/tierUtils.ts`, `src/utils/accessControl.ts`, `src/hooks/useClerkAuth.ts`
- Pattern: Enum-based tier (free/pro/executive/community/verified_vendor/viewer); helper functions (`isProUser()`, `resolveVendorAccess()`)

**RLS-Protected Supabase Client:**
- Purpose: Ensure all Supabase requests include Clerk JWT so RLS policies can enforce tier-based read/write access
- Examples: `useClerkSupabase()` in `src/hooks/useClerkSupabase.ts`; default anon client in `src/integrations/supabase/client.ts`
- Pattern: Context-aware token fetch; Supabase SDK custom `accessToken` callback

**WAM API Wrapper:**
- Purpose: Centralized fetch wrapper for Railway backend; handles auth header, error handling, response parsing
- Examples: `useWamApi()` in `src/hooks/useWamApi.ts`
- Pattern: Callback-based API with named methods for vendor queue, chat, PDF, tasks, trends; X-Password auth header

**Vendor Data Aggregator:**
- Purpose: Single source of truth for vendor mentions, themes, trends, product lines, metadata
- Examples: `fetchVendorPulseFeed()`, `fetchVendorsList()`, `fetchVendorThemes()` in `src/hooks/useSupabaseVendorData.ts`
- Pattern: Async functions returning typed results; tier-aware filtering (redaction for free users)

## Entry Points

**Web Application:**
- Location: `src/main.tsx`
- Triggers: Browser loads `index.html` → Vite loads main.tsx
- Responsibilities: Initialize Clerk auth, render React root, provide context providers

**Public Routes:**
- Location: `src/pages/VendorsV2.tsx`, `src/pages/VendorProfile.tsx`, `src/pages/VendorDashboardPage.tsx`, `src/pages/VendorClaimPage.tsx`
- Triggers: User navigates via `/vendors`, `/vendors/:vendorSlug`, `/vendor-dashboard`, `/claim/:token`
- Responsibilities: Render vendor browser, profile detail, self-service dashboard, claim flow

**Admin Routes:**
- Location: `src/pages/admin/*` (AdminDashboard, VendorQueuePage, TopicModerationPage, etc.)
- Triggers: User navigates to `/admin/*` → AdminGuard checks `isAdmin`
- Responsibilities: Render admin panels for queue processing, group management, task scheduling, AI chat, settings

**Unauthenticated Routes:**
- Location: `src/pages/Auth.tsx`, `src/pages/NotFound.tsx`
- Triggers: `/auth` (Clerk SignIn form), `*` (404 fallback)
- Responsibilities: Auth flow, error page

## Error Handling

**Strategy:** Try-catch with fallback messages; Sonner toast notifications for user feedback

**Patterns:**

- **Supabase errors:** Caught in hooks (e.g., `useSupabaseVendorData`); checked via `{ data, error }` destructuring
  ```typescript
  const { data, error } = await supabase.from('table').select();
  if (error) throw error;
  ```

- **WAM API errors:** Caught in `useWamApi()` wrapper; response checked for 200 status; error body parsed
  ```typescript
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw { status: res.status, error: body };
  }
  ```

- **Component-level:** Try-catch in async callbacks; Sonner toast for display
  ```typescript
  try {
    await operation();
  } catch (err) {
    toast.error(`Failed: ${err.message}`);
  }
  ```

- **UI fallbacks:** Loading spinners (Loader2), error messages in state, disabled buttons during async operations

## Cross-Cutting Concerns

**Logging:** No structured logger configured; `console.log` used ad-hoc in development; production logging via Clerk (auth) and Supabase (database)

**Validation:** Zod schema used for form inputs and API responses where applicable; TypeScript strict mode OFF so runtime validation important

**Authentication:** Clerk handles identity + session; Supabase RLS + custom Clerk JWT integration handles authorization

**Caching:** React Query manages HTTP cache; Supabase session cached in localStorage; WAM admin session in sessionStorage

---

*Architecture analysis: 2026-04-13*
