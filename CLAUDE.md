# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server on localhost:8080
npm run build        # Production build (vite build)
npm run build:dev    # Development build
npm run lint         # ESLint
npm run preview      # Preview production build
```

No unit test framework is configured. E2E tests use Playwright (`npx playwright test`).

Supabase Edge Functions live in `supabase/functions/` and are deployed via `supabase functions deploy <function-name>`.

## Architecture

**CDG Pulse** is an automotive dealer industry SaaS platform with tier-based access (free/pro/executive/admin). It provides vendor intelligence extracted from WhatsApp dealer group conversations using AI.

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite (SWC), deployed on Vercel
- **UI**: shadcn/ui + Radix primitives + Tailwind CSS + Framer Motion
- **Auth**: Clerk (JWT tokens passed to Supabase)
- **Database**: Supabase PostgreSQL (public schema for app data, wam schema for WhatsApp/AI pipeline)
- **Server state**: TanStack React Query
- **AI**: Google Gemini (via WAM backend on Railway)
- **Charts**: Recharts

### Multi-Backend Architecture
```
Frontend (React)
  ├── Supabase JS Client (RLS + Clerk JWT auth) → PostgreSQL
  │     └── Edge Functions (vendor-ai-chat, sales-ai-search, etc.)
  └── WAM API (X-Password header auth) → Railway backend
        ├── whatsapp-web.js + Puppeteer
        ├── Gemini AI processing
        └── Direct Postgres connection (service-role)
```

### Key Patterns
- **Path alias**: `@/` maps to `src/` (configured in vite.config.ts and tsconfig.json)
- **Admin routes**: Lazy-loaded, wrapped in `AdminGuard` + `AdminLayout` under `/admin/*`
- **Auth hooks**: `useClerkAuth()` for user/tier/role, `useClerkSupabase()` for authenticated Supabase client
- **WAM API**: `useWamApi()` hook, authenticates via `X-Password` header with value from `sessionStorage.getItem("wam_password")`
- **TypeScript**: Strict mode is OFF (`noImplicitAny: false`, `strictNullChecks: false`)
- **Supabase types**: Auto-generated in `src/integrations/supabase/types.ts`

### Database Schemas
- **public schema** (RLS-protected): profiles, user_roles, vendor_reviews, vendor_profiles, vendor_mentions, vendor_pulse_insights, vendor_groups, vendor_aliases, vendor_metadata, etc.
- **wam schema** (service-role only): groups, messages, topics, task_definitions, task_occurrences, vendor_processing_queue, ai_chat_conversations, trend_reports, etc.

### User Tiers & Roles
Enum `app_role`: free, pro, executive, viewer, verified_vendor, admin. Tier determines data visibility (e.g., free users see redacted vendor mentions, pro users see full data).

### Key Directories
- `src/pages/` — Route pages; `src/pages/admin/` for admin panel
- `src/components/ui/` — shadcn primitives (do not edit manually)
- `src/components/admin/` — Admin dashboard components
- `src/components/vendor-dashboard/` — Vendor self-service dashboard
- `src/hooks/` — 20+ custom hooks for auth, data fetching, state
- `src/integrations/supabase/` — Supabase client and auto-generated types
- `src/config/wam.ts` — WAM API URL configuration
- `src/utils/` — Tier utilities, access control
- `supabase/functions/` — 15+ Edge Functions
- `supabase/migrations/` — 120+ database migration files

### Environment Variables
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — Supabase connection
- `VITE_CLERK_PUBLISHABLE_KEY` — Clerk auth (auto-switches between prod/preview by hostname)
- `VITE_WAM_URL` — WAM backend URL (defaults to Railway production)
- `VITE_STRIPE_CHECKOUT_URL` — Stripe billing link

### MCP Setup
See `.claude/README.md` for Supabase MCP configuration. Copy `.claude/mcp.json.example` to `.claude/mcp.json` and fill in credentials. Never commit `mcp.json` files.
