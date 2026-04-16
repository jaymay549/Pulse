# External Integrations

**Analysis Date:** 2026-04-13

## APIs & External Services

**Authentication:**
- Clerk - User authentication and session management
  - SDK: `@clerk/clerk-react` 5.60.0
  - Auth: `VITE_CLERK_PUBLISHABLE_KEY` (auto-switches between prod/preview by hostname)
  - Integration: ClerkProvider wraps React application in `src/main.tsx`
  - Features: JWT tokens passed to Supabase, organization-scoped tokens for vendor permissions

**AI & Language Model:**
- Google Gemini API - AI-powered chat, analysis, and content generation
  - Model: `gemini-2.0-flash`
  - Integration: Called via Supabase Edge Functions (e.g., `src/supabase/functions/generate-vendor-intelligence/index.ts`)
  - Purpose: Vendor intelligence generation, sales analysis, theme extraction

**WAM (WhatsApp Automation Manager) Backend:**
- Railway-hosted backend service for WhatsApp and AI operations
  - URL: `VITE_WAM_URL` (defaults to `https://cdg-wam-production.up.railway.app`)
  - SDK: Custom `useWamApi()` hook in `src/hooks/useWamApi.ts`
  - Auth: X-Password header with password stored in `sessionStorage.wam_password`
  - Endpoints:
    - `/api/vendor-pulse/queue/*` - Vendor queue processing
    - `/api/ai/chat` - AI chat operations
    - `/api/chat/*` - Conversation management
    - `/api/pdf/*` - PDF generation and download
    - `/api/send` - WhatsApp message sending
    - `/api/occurrences/*` - Task occurrence management
    - `/api/trends/generate` - Trend report generation
    - `/api/debug/*` - Debug endpoints (Gemini testing, WhatsApp methods)

**Payment & Billing:**
- Stripe - Payment processing and billing
  - Checkout links embedded in components (`src/components/Pricing.tsx`, `src/components/vendors/VendorPricingTiers.tsx`)
  - Env: `VITE_STRIPE_CHECKOUT_URL` and `VITE_STRIPE_PORTAL_URL` (optional)
  - Integration: External redirect to Stripe hosted checkout pages

**Member Data Sync:**
- Airtable - Member profile synchronization (via Supabase Edge Function)
  - Integration: `src/supabase/functions/sync-airtable-members/` Edge Function
  - Called from: `src/pages/admin/MembersPage.tsx`
  - Purpose: Sync member profiles from Airtable to Pulse database

## Data Storage

**Databases:**
- Supabase PostgreSQL - Primary application database
  - Connection: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
  - Client: `@supabase/supabase-js` 2.76.1
  - Schemas:
    - `public` (RLS-protected) - User data, vendor profiles, mentions, reviews, insights, groups, aliases, metadata
    - `wam` (service-role only) - WhatsApp groups, messages, topics, task definitions, AI chat conversations, trend reports
  - Migration files: 120+ migrations in `supabase/migrations/`
  - Auto-generated types: `src/integrations/supabase/types.ts`

**File Storage:**
- No external file storage service detected - likely uses Supabase Storage or local assets

**Caching:**
- None detected at integration level (React Query handles client-side cache)

## Authentication & Identity

**Auth Provider:**
- Clerk (JWT-based)
  - Implementation: Multi-tier user system (free, pro, executive, viewer, verified_vendor, admin)
  - Session tokens include user tier and vendor metadata
  - Organization-scoped tokens for vendor dashboard access
  - Clerk integration configured with Supabase for RLS policy evaluation

**Multi-Tier Access Control:**
- User tiers: free, pro, executive, admin
- Metadata stored in Clerk `publicMetadata.circles`:
  - `tier` - User subscription tier
  - `status` - Subscription status (active, past_due, canceled, unpaid, paused)
  - `role` - User role (admin, user)

## Monitoring & Observability

**Error Tracking:**
- Not detected (Google Gemini API errors logged locally)

**Logs:**
- Console logging (likely via browser DevTools or application logs)
- Supabase Edge Function logs visible via Supabase Dashboard

**Analytics:**
- Google Analytics - Tracked via custom GTags in components
  - Tracking ID: Managed per environment
  - Integration: Via `react-helmet-async` for page tracking

## CI/CD & Deployment

**Hosting:**
- Vercel - Frontend deployment
  - Configuration: `vercel.json` with SPA rewrite rules
  - Preview deployments for feature branches
  - Automatic deployments on git push to main/staging

**Supabase Functions Deployment:**
- Manual deployment via CLI: `supabase functions deploy <function-name>`
- 15+ Edge Functions for backend operations

**WAM Backend:**
- Railway - Hosted WAM service
  - WhatsApp.js + Puppeteer for browser automation
  - Gemini API integration for AI
  - Direct PostgreSQL connection with service role

## Environment Configuration

**Required env vars:**
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key
- `VITE_CLERK_PUBLISHABLE_KEY` - Clerk public key (overridden by hostname logic for prod/preview)
- `VITE_WAM_URL` - WAM backend URL (defaults to Railway production)
- `VITE_STRIPE_CHECKOUT_URL` - Stripe checkout link

**Optional env vars:**
- `VITE_STRIPE_PORTAL_URL` - Stripe customer portal URL
- `VITE_LOGO_DEV_TOKEN` - Development token for logo service

**Secrets location:**
- `.env` file (not committed - use `.env.example` as template)
- Vercel project settings for production secrets
- WAM password stored in browser `sessionStorage.wam_password` (set via admin settings page)

## Webhooks & Callbacks

**Incoming:**
- `/api/vendor-claim-notify` - Supabase Edge Function webhook for vendor claim notifications
- `/api/enrich-mentions` - Webhook for mention enrichment processing
- `/api/vendor-enrich` - Webhook for vendor profile enrichment

**Outgoing:**
- Stripe webhook callbacks - For payment status updates
- Airtable sync endpoint - Called from admin MembersPage

## Third-Party Integration Points

**Clerk + Supabase Integration:**
- Clerk JWT tokens carry custom claims for Supabase RLS:
  - `role: "authenticated"`
  - `user_tier` - User's subscription tier
  - `vendor_paid`, `vendor_verified`, `vendor_tier` - Vendor org status
  - `vendor_names` - Vendor names from org metadata
  - `org_id` - Organization ID (for vendor org filtering)
- RLS policies in Supabase evaluate JWT claims for access control

**Data Flow:**
```
Frontend (React + Clerk auth)
  ├─→ Supabase JS Client (with Clerk JWT) → PostgreSQL (RLS enforced)
  │     └─→ Edge Functions
  │         ├─→ Google Gemini (AI operations)
  │         ├─→ Airtable (member sync)
  │         └─→ Supabase Storage
  └─→ WAM API (X-Password header) → Railway backend
        ├─→ WhatsApp.js + Puppeteer
        ├─→ Google Gemini (AI)
        └─→ PostgreSQL (wam schema, service-role)
```

---

*Integration audit: 2026-04-13*
