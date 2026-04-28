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

<!-- GSD:project-start source:PROJECT.md -->
## Project

**Vendor Tiering System**

A vendor authentication and tiering system for CDG Pulse. Vendors authenticate via Supabase magic link (separate from the existing Clerk-based dealer/admin auth) and access a tiered vendor dashboard. The sales team creates vendor credentials through the admin panel after closing deals.

**Core Value:** Vendors can securely log in via magic link and see only the data their tier permits — separate from dealer auth, managed by the sales team.

### Constraints

- **Auth separation**: Vendor auth must not interfere with existing Clerk auth flow
- **Supabase magic link**: Use Supabase Auth's built-in magic link — no custom email infrastructure
- **Brownfield**: Must integrate with existing codebase patterns (React 18, TypeScript, TanStack Query, shadcn/ui)
- **RLS**: Tier gating enforced at database level via Row-Level Security, not just frontend
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript 5.8.3 - Frontend application and Edge Functions
- JavaScript (modern ES modules) - Configuration files and runtime
- SQL - Database queries and migrations (Supabase PostgreSQL)
- Bash/Shell - Build and deployment scripts
## Runtime
- Node.js (JavaScript ES modules) - Development and build environment
- Deno - Supabase Edge Functions runtime (based on Deno standard library)
- Web browsers - Client-side React application
- npm 10+ (inferred from `"type": "module"` in package.json)
- Lockfile: Present (`package-lock.json`)
## Frameworks
- React 18.3.1 - UI framework
- React Router DOM 6.30.1 - Client-side routing
- TypeScript - Type safety and development experience
- Vite 5.4.19 - Frontend build tool and dev server
- SWC (via `@vitejs/plugin-react-swc` 3.11.0) - Fast JavaScript transpiler
- PostCSS 8.5.6 - CSS processing
- Tailwind CSS 3.4.17 - Utility-first CSS framework
- shadcn/ui - Headless component library
- Radix UI 1.x - Accessible primitive components
- Playwright 1.57.0 - E2E testing framework (via `@playwright/test`)
- No unit test framework configured
- Lucide React 0.462.0 - Icon library
- Framer Motion 12.26.1 - Animation library
- Tailwind Merge 2.6.0 - Merge Tailwind class utilities
- Tailwindcss Animate 1.0.7 - Animation utilities for Tailwind
- Recharts 3.7.0 - Composable charting library
- Embla Carousel 8.6.0 - Carousel component
- Sonner 1.7.4 - Toast notifications
- Vaul 0.9.9 - Drawer primitive
- React Helmet Async 2.0.5 - Head management for SEO
- React Markdown 10.1.0 - Markdown parsing and rendering
- Input OTP 1.4.2 - OTP input component
- ESLint 9.32.0 - JavaScript linting
- `@eslint/js` 9.32.0 - ESLint recommended config
- `typescript-eslint` 8.38.0 - TypeScript ESLint support
- `eslint-plugin-react-hooks` 5.2.0 - React hooks linting
- `eslint-plugin-react-refresh` 0.4.20 - React Fast Refresh linting
- Autoprefixer 10.4.21 - CSS vendor prefix plugin
- Lovable Tagger 1.1.11 - Component tagging for development
- @types/node 22.16.5 - Node.js type definitions
- @types/react 18.3.23 - React type definitions
- @types/react-dom 18.3.7 - React DOM type definitions
- TanStack React Query 5.83.0 - Server state management
- Zod 3.25.76 - TypeScript-first schema validation
- CSS variables (CSS custom properties) - Theme support with HSL colors
- Dark mode support via `next-themes` 0.3.0
- Class Variance Authority 0.7.1 - CSS-in-JS variant management
- CLSX 2.1.1 - Class name utility
- html2canvas 1.4.1 - HTML to canvas rendering
## Key Dependencies
- `@supabase/supabase-js` 2.76.1 - Supabase PostgreSQL client with Row-Level Security (RLS)
- `@clerk/clerk-react` 5.60.0 - Authentication and session management with JWT tokens
- `@tanstack/react-query` 5.83.0 - Server state synchronization
- React 18.3.1 - Core framework
- Vite 5.4.19 - Build and dev infrastructure
- TypeScript 5.8.3 - Type safety
## Configuration
- Configured via `.env` file (not committed to repository)
- Example configuration in `.env.example`:
- Additional variables loaded from environment at build time:
- `vite.config.ts` - Vite configuration with SWC plugin and path aliases
- `tsconfig.json` - TypeScript compilation settings
- `tailwind.config.ts` - Tailwind CSS customization with extended theme
- `postcss.config.js` - PostCSS configuration for Tailwind
- `eslint.config.js` - ESLint configuration with TypeScript and React hooks support
- `playwright.config.ts` - E2E test configuration using Lovable preset
## Platform Requirements
- Node.js (ES modules support required)
- npm or yarn package manager
- Vite dev server runs on `localhost:8080`
- TypeScript 5.8.3+
- Vercel (deployment platform)
- GitHub for version control
- Supabase PostgreSQL database
- Clerk authentication backend
- Railway (WAM backend)
- Google Gemini API (for Edge Functions)
- Stripe (billing integration)
## Scripts
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- React components: PascalCase, e.g., `AdminGuard.tsx`, `VendorCard.tsx`
- Custom hooks: camelCase with `use` prefix, e.g., `useClerkAuth.ts`, `useAdminGroups.ts`
- UI components (shadcn): kebab-case, e.g., `smart-search-bar.tsx`, `phone-input.tsx`
- Utilities: camelCase, e.g., `tierUtils.ts`, `accessControl.ts`, `markdown.tsx`
- Type definition files: PascalCase, e.g., `admin.ts`, `sales-targets.ts`
- React components: PascalCase, e.g., `AdminGuard`, `VendorIntelSection`
- Custom hooks: PascalCase with `use` prefix, e.g., `useClerkAuth`, `useAdminGroups`
- Utility functions: camelCase, e.g., `isProUser()`, `getAccessLevel()`, `isPaidTier()`
- Event handlers: camelCase with verb prefix, e.g., `handleSubmit`, `onSuccess`, `onChatIdChange`
- Constants: UPPER_SNAKE_CASE, e.g., `MAX_POLL_ATTEMPTS`, `POLL_INTERVAL`, `RETRYABLE_STATUSES`
- React state: camelCase, e.g., `current`, `showGainAccess`, `loading`
- Component props: camelCase, e.g., `initialChatId`, `onChatIdChange`, `onSuccess`
- Type/Interface properties: camelCase or snake_case matching database schema, e.g., `vendor_name`, `group_id`
- Interfaces/Types: PascalCase with descriptive suffix, e.g., `ChatMessage`, `WhatsAppGroup`, `VendorQueueItem`
- Type unions: PascalCase, e.g., `QueueStatus`, `TopicStatus`, `TaskStatus`
- Generic props interfaces: PascalCase with `Props` suffix, e.g., `AIChatBoxProps`, `AdminGuardProps`
- Enum-like type unions: "word1" | "word2" format in lowercase, e.g., `"pending" | "processing" | "processed"`
## Code Style
- No dedicated Prettier config detected. Format follows React/TypeScript conventions.
- Indent: 2 spaces (inferred from codebase)
- Line length: No strict limit observed; some lines exceed 120 characters
- Semicolons: Required at end of statements
- Trailing commas: Used in objects, arrays, and function parameters
- Tool: ESLint (eslint.config.js with flat config format)
- Key settings:
- TypeScript: Strict mode disabled
## Import Organization
- `@/` maps to `src/`
- Configured in `vite.config.ts` and `tsconfig.json`
- Always use `@/` prefix for project imports, never relative paths like `../../../`
## Error Handling
- Errors thrown from async functions via `throw error`
- Errors logged with context prefix: `console.error("[Service] operation error:", error)`
- Service function pattern: return normalized result object or throw
- React Query integration: errors thrown in `queryFn` are automatically caught by React Query
- No global error boundary detected; errors propagate to component level
- Direct function calls throw on error
- React Query wrapped functions: errors captured in error state and queryFn throws
- WAM API calls via `useWamApi()` hook handle auth via `X-Password` header
## Logging
- Error logs: `console.error("[Context] message:", error)` with service/location prefix in brackets
- Prefix format: `[ServiceName]` or `[FunctionName]` for context
- Errors logged at point of failure, not propagated silently
- No info/debug logging observed in analyzed files; logs are error-focused
## Comments
- JSDoc/TSDoc: Used for utility functions and type documentation
- Inline comments: Minimal; used only where logic is non-obvious
- Section headers: `// ── Section Name ──` pattern used in type files (e.g., `admin.ts`)
- Sample data: Documented inline, e.g., `// Sample examples for the preview`
- Used on exported utility functions: `/** * Description * */`
- Used on public hook functions
- Type definitions include descriptions via JSDoc comments
- Example (from tierUtils.ts):
## Function Design
- Most functions stay under 100 lines
- Larger components split into subcomponents, e.g., `VendorCard` extracted from main page
- Average hook: 20-60 lines
- Pages: 100-1700+ lines (large pages delegate to subcomponents)
- Prefer named parameters object for functions with >2 params
- React component props: always destructured as single props parameter
- Optional parameters: marked with `?` in types, not `undefined` union
- Example (from useClerkAuth):
- Utility functions: return typed result or throw
- React hooks: return state object with properties
- Query functions: return normalized data or throw
- Mutable functions: return mutationFn result or void, errors thrown
- Example (from useAdminGroups):
## Module Design
- Hooks: exported as named exports (not default), e.g., `export function useClerkAuth()`
- Components: exported as default or named, both patterns used
- Types: exported as named exports with `export type` or `export interface`
- Constants: exported as named exports
- Example (from admin.ts type file):
- Used for component groupings: `src/components/vendors/index.ts`
- Pattern: re-export all public components from subdirectory
- Example (vendors/index.ts):
- No barrel files in hooks or utils directories; direct imports used
## Multi-Backend Architecture Patterns
- Imported as: `import { supabase } from "@/integrations/supabase/client"`
- Auto-generated types: `src/integrations/supabase/types.ts`
- RPC calls: `supabase.rpc("function_name", { p_param: value })`
- Schema selection: `supabase.schema("wam" as any)` for WAM schema access
- JWT Auth: Handled automatically via Clerk integration
- Accessed via `useWamApi()` hook
- Auth: `X-Password` header from `sessionStorage.getItem("wam_password")`
- Base URL: configured in `src/config/wam.ts`
- Fallback: direct WAM API calls if not available
- Query key pattern: string array, e.g., `["admin-groups"]`, `["group-messages", groupId]`
- Invalidation: `queryClient.invalidateQueries({ queryKey: ["admin-groups"] })`
- Enabled queries: `enabled: !!groupId` pattern for conditional queries
- Stale time: set on queries that cache well, e.g., `staleTime: 5 * 60 * 1000`
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- Dual-backend architecture: Supabase PostgreSQL for RLS-protected app data, WAM API (Railway) for WhatsApp/AI pipeline
- Clerk-managed authentication with JWT tokens passed to both backends
- Tier-based access control: free → pro → executive, with vendor-org access as alternative
- Lazy-loaded admin routes with AdminGuard protection
- React Query for server-side state, React Router for navigation
- Supabase Edge Functions for AI-driven vendor intelligence generation
## Layers
- Purpose: UI rendering, user interaction, form handling
- Location: `src/components/` and `src/pages/`
- Contains: Functional components using shadcn/ui + Tailwind, page containers, modals, filters, charts (Recharts)
- Depends on: Custom hooks, utilities, shadcn primitives, Radix UI
- Used by: Browser; rendered by React
- Purpose: Server-side data fetching, caching, synchronization with backends
- Location: `src/hooks/` (20+ hooks)
- Contains: `useClerkAuth()`, `useClerkSupabase()`, `useWamApi()`, `useVendorFilters()`, `useSupabaseVendorData()`, etc.
- Depends on: Clerk SDK, Supabase client, axios/fetch, React Query
- Used by: All components that need data
- Purpose: Identity verification, tier determination, role assignment
- Location: `src/hooks/useClerkAuth.ts`, `src/hooks/useClerkSupabase.ts`, `src/utils/tierUtils.ts`, `src/utils/accessControl.ts`
- Contains: Tier enums (free/pro/executive/community), metadata resolution, Supabase RLS token assembly
- Depends on: Clerk SDK, Supabase client
- Used by: All pages and hooks requiring auth or permission checks
- Purpose: Communication with Supabase (RLS-protected) and WAM API (WhatsApp/AI)
- Location: `src/integrations/supabase/`, `src/config/wam.ts`, `src/hooks/useWamApi.ts`, `src/hooks/useSupabaseVendorData.ts`
- Contains: Supabase client factory, WAM API wrapper, auto-generated TypeScript types, Edge Function calls
- Depends on: Supabase JS SDK, fetch API, environment variables
- Used by: All data-fetching hooks and components
- Purpose: Helper functions, tier checking, access control, markdown rendering
- Location: `src/utils/`, `src/lib/`
- Contains: `tierUtils.ts` (access level checks), `accessControl.ts` (unified vendor permission resolver), `markdown.tsx`, `vendorPortalApi.ts`
- Depends on: Types
- Used by: Components and hooks
- Purpose: TypeScript definitions, enums, configuration
- Location: `src/types/`, `src/constants/`, `src/integrations/supabase/types.ts`
- Contains: Auto-generated Supabase schema types, admin types, vendor types
- Depends on: None (leaf layer)
- Used by: All other layers
## Data Flow
- Server state: React Query caches Supabase/WAM responses (5-min default TTL)
- Client state: Component-local via `useState()` (filters, modal open/close, selections)
- Session state: Clerk session in browser memory; Supabase session in localStorage
- Admin session: WAM password stored in sessionStorage (not persisted)
## Key Abstractions
- Purpose: Unified permission framework across frontend and backend
- Examples: `src/utils/tierUtils.ts`, `src/utils/accessControl.ts`, `src/hooks/useClerkAuth.ts`
- Pattern: Enum-based tier (free/pro/executive/community/verified_vendor/viewer); helper functions (`isProUser()`, `resolveVendorAccess()`)
- Purpose: Ensure all Supabase requests include Clerk JWT so RLS policies can enforce tier-based read/write access
- Examples: `useClerkSupabase()` in `src/hooks/useClerkSupabase.ts`; default anon client in `src/integrations/supabase/client.ts`
- Pattern: Context-aware token fetch; Supabase SDK custom `accessToken` callback
- Purpose: Centralized fetch wrapper for Railway backend; handles auth header, error handling, response parsing
- Examples: `useWamApi()` in `src/hooks/useWamApi.ts`
- Pattern: Callback-based API with named methods for vendor queue, chat, PDF, tasks, trends; X-Password auth header
- Purpose: Single source of truth for vendor mentions, themes, trends, product lines, metadata
- Examples: `fetchVendorPulseFeed()`, `fetchVendorsList()`, `fetchVendorThemes()` in `src/hooks/useSupabaseVendorData.ts`
- Pattern: Async functions returning typed results; tier-aware filtering (redaction for free users)
## Entry Points
- Location: `src/main.tsx`
- Triggers: Browser loads `index.html` → Vite loads main.tsx
- Responsibilities: Initialize Clerk auth, render React root, provide context providers
- Location: `src/pages/VendorsV2.tsx`, `src/pages/VendorProfile.tsx`, `src/pages/VendorDashboardPage.tsx`, `src/pages/VendorClaimPage.tsx`
- Triggers: User navigates via `/vendors`, `/vendors/:vendorSlug`, `/vendor-dashboard`, `/claim/:token`
- Responsibilities: Render vendor browser, profile detail, self-service dashboard, claim flow
- Location: `src/pages/admin/*` (AdminDashboard, VendorQueuePage, TopicModerationPage, etc.)
- Triggers: User navigates to `/admin/*` → AdminGuard checks `isAdmin`
- Responsibilities: Render admin panels for queue processing, group management, task scheduling, AI chat, settings
- Location: `src/pages/Auth.tsx`, `src/pages/NotFound.tsx`
- Triggers: `/auth` (Clerk SignIn form), `*` (404 fallback)
- Responsibilities: Auth flow, error page
## Error Handling
- **Supabase errors:** Caught in hooks (e.g., `useSupabaseVendorData`); checked via `{ data, error }` destructuring
- **WAM API errors:** Caught in `useWamApi()` wrapper; response checked for 200 status; error body parsed
- **Component-level:** Try-catch in async callbacks; Sonner toast for display
- **UI fallbacks:** Loading spinners (Loader2), error messages in state, disabled buttons during async operations
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

| Skill | Description | Path |
|-------|-------------|------|
| firecrawl | \| Official Firecrawl CLI skill for web scraping, search, crawling, and browser automation. Returns clean LLM-optimized markdown. | `.agents/skills/firecrawl/SKILL.md` |
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
