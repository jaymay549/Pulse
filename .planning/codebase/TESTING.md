# Testing Patterns

**Analysis Date:** 2026-04-13

## Test Framework

**Runner:**
- Playwright (E2E testing)
- Version: ^1.57.0 (from package.json)
- Config: `playwright.config.ts`
- **No unit test framework is configured** (per CLAUDE.md)

**Build/Test Commands:**
```bash
npx playwright test              # Run E2E tests
npm run dev                      # Start dev server for testing
npm run build                    # Production build
npm run lint                     # ESLint
```

**Test Status:**
- No unit tests found in codebase
- No Jest, Vitest, or other unit test runner configured
- E2E tests via Playwright (configuration exists but no test files present in repo)

## Test File Organization

**Location:**
- E2E tests: intended for `e2e/` directory (default Playwright location, per config comment)
- No `__tests__` or `.test`/`.spec` files found in `src/`
- Currently no test files committed to repository

**Naming:**
- Expected format (per Playwright convention): `*.spec.ts` or `*.test.ts`
- Not yet established in codebase

**Structure:**
- Playwright configured via lovable-agent-playwright-config
- Config location: `playwright.config.ts`

## Playwright Configuration

**Config File:** `playwright.config.ts`

```typescript
import { createLovableConfig } from "lovable-agent-playwright-config/config";

export default createLovableConfig({
	// Tests should be placed in the 'e2e' folder (default)
	// Custom overrides can be added here
	// Example timeout: 60000
	// baseURL: 'http://localhost:3000'
});
```

**Key Settings:**
- Uses Lovable's standard Playwright config wrapper
- Default test location: `e2e/` directory
- Supports custom overrides (timeout, baseURL, etc.)
- Not currently customized beyond default

## Testing Strategy

**Current Approach:**
- E2E testing only (Playwright)
- No unit tests
- No integration test framework

**Development/QA Flow:**
```bash
npm run dev              # Start app on localhost:8080
npx playwright test      # Run E2E tests
```

**When to Test:**
- Before deploying to Vercel
- Manual testing via `npm run dev` and browser
- No pre-commit hooks for tests detected

## Manual Testing Approach

**Development Server:**
- Start: `npm run dev` (runs on localhost:8080)
- Hot reload via Vite
- Built with React 18 + Vite + SWC

**Browser Testing:**
- Manual testing in browser during development
- Mock/stub data loaded via Supabase and WAM API
- Test users via Clerk authentication

## Data & Dependencies for Testing

**Authentication:**
- Clerk integration: `useClerkAuth()` hook provides test user context
- Test user tiers: "free", "pro", "community", "executive"
- Admin role: check via `user.publicMetadata.circles.role === "admin"`

**Test Data Sources:**
- Supabase RLS-protected `public` schema (main app data)
- Supabase `wam` schema (WhatsApp/AI pipeline, service-role only)
- WAM API: requires X-Password header from sessionStorage
- Clerk mock users or real test accounts

**Mock Data Pattern:**
- Sample data inline in components, e.g., `sampleItems` array in `VendorIntelSection.tsx`
- No centralized test fixtures or factories
- Supabase queries return real data from test environment

## Key Testing Concerns

**What IS Tested:**
- User authentication flows (Clerk integration)
- Tier-based access control (free vs pro vs admin)
- Navigation and page routing
- Component rendering with real API data

**What IS NOT Tested:**
- Error handling edge cases
- Empty states and loading states
- Offline behavior
- API failure scenarios
- Large dataset performance

**Test Gaps (High Priority):**
- No error boundary tests
- No async error handling tests (API failures, timeouts)
- No form validation tests
- No tier-gating logic tests (unit)
- No Supabase RLS tests

## Local Development Testing

**Required Setup:**
```bash
npm install                    # Install dependencies
npm run dev                    # Start dev server
```

**Environment:**
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Anon key (RLS enforced via Clerk JWT)
- `VITE_CLERK_PUBLISHABLE_KEY` — Clerk public key
- `VITE_WAM_URL` — WAM backend URL (optional, defaults to Railway prod)
- See CLAUDE.md for full environment setup

**Testing Admin Features:**
- Sign in with admin-tier Clerk user
- Access `/admin/*` routes (guarded by `AdminGuard` component)
- Test data via Supabase RPC functions and WAM API

## API Mocking Patterns

**Supabase:**
- No mocking layer; uses real Supabase client
- RLS enforced via Clerk JWT in request headers
- Test against staging Supabase project

**WAM API:**
- No mocking; direct HTTP calls via `useWamApi()` hook
- Auth via `X-Password` header
- Would need test WAM instance or stub server for offline tests

**Sample Test Scenario (Manual):**
```typescript
// Example: Test vendor profile page access
1. Start dev server: npm run dev
2. Navigate to /vendors/[vendor-slug]
3. Clerk prompts for sign-in (use test account)
4. If free tier: see redacted vendor mentions
5. If pro tier: see full vendor intel
6. If admin: see admin panel features
```

## Future Testing Roadmap

**To Enable Unit Testing:**
1. Choose framework: Vitest (recommended for Vite) or Jest
2. Install: `npm install -D vitest @vitest/ui`
3. Configure: `vitest.config.ts`
4. Create test files: `src/**/*.test.ts(x)` or `src/__tests__/**/*.ts(x)`
5. Add pre-commit hook to run tests

**Priority Test Areas (by Impact):**
1. Tier utility functions: `tierUtils.ts` — high coverage (many components depend)
2. Auth hooks: `useClerkAuth.ts`, `useClerkSupabase.ts` — medium coverage
3. Data fetching hooks: `useSupabaseVendorData.ts` — medium coverage
4. Type guards and validators: utility functions — medium coverage
5. Component edge cases: modals, dropdowns, tables — low priority (E2E covers)

**Example Unit Test (Vitest/Vitest):**
```typescript
import { describe, it, expect } from 'vitest';
import { isProUser, isPaidTier, getAccessLevel } from '@/utils/tierUtils';

describe('tierUtils', () => {
  describe('isProUser', () => {
    it('should return true for pro tier', () => {
      expect(isProUser('pro')).toBe(true);
    });

    it('should return true for executive tier', () => {
      expect(isProUser('executive')).toBe(true);
    });

    it('should return false for free tier', () => {
      expect(isProUser('free')).toBe(false);
    });

    it('should handle null/undefined', () => {
      expect(isProUser(null)).toBe(false);
      expect(isProUser(undefined)).toBe(false);
    });
  });

  describe('isPaidTier', () => {
    it('should return true only for pro and executive', () => {
      expect(isPaidTier('pro')).toBe(true);
      expect(isPaidTier('executive')).toBe(true);
      expect(isPaidTier('community')).toBe(false);
      expect(isPaidTier('free')).toBe(false);
    });
  });

  describe('getAccessLevel', () => {
    it('should grant unlimited access for pro users', () => {
      const result = getAccessLevel('pro');
      expect(result.unlimitedAccess).toBe(true);
    });

    it('should deny unlimited access for free users', () => {
      const result = getAccessLevel('free');
      expect(result.unlimitedAccess).toBe(false);
    });
  });
});
```

## Debugging During Development

**Chrome DevTools:**
- React DevTools extension: inspect component state and hooks
- Playwright Inspector: `npx playwright test --debug` (for E2E)

**Logging:**
- Console errors logged with context prefix: `console.error("[Service]", error)`
- Supabase errors logged: `console.error("[Supabase]", error)`
- No log aggregation service (Sentry, etc.) detected

**Common Issues:**
- Tier mismatches: check Clerk user metadata in DevTools
- RLS errors: verify Clerk JWT passed to Supabase client
- WAM API auth: check sessionStorage for `wam_password`
- Route access: use `AdminGuard` component to debug admin routes

---

*Testing analysis: 2026-04-13*
