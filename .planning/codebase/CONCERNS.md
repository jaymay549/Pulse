# Codebase Concerns

**Analysis Date:** 2026-04-13

## Tech Debt

**Disabled TypeScript Strict Mode:**
- Issue: TypeScript strict checks are disabled (`noImplicitAny: false`, `strictNullChecks: false`)
- Files: `tsconfig.json`
- Impact: Type safety reduced, potential runtime errors from null/undefined propagation, harder to refactor safely, difficult to catch edge cases during development
- Fix approach: Enable strict mode incrementally, starting with new files, then gradually refactor existing code with proper null checks and type annotations

**Loose Error Handling Throughout Codebase:**
- Issue: Many catch blocks use empty handlers (`catch {}` or `catch (e: any)`) without logging or recovery strategy
- Files: `src/components/admin/tasks/HtmlEditorModal.tsx`, `src/components/vendors/InlineAIChat.tsx`, `src/components/vendors/VendorCard.tsx`, `src/components/WamAuthModal.tsx` (and 40+ files with `catch` blocks)
- Impact: Silent failures make debugging difficult, unhandled errors don't propagate to monitoring systems, users unaware of failures
- Fix approach: Implement consistent error handling pattern with logging, user feedback, and error boundaries; add global error boundary and monitoring

**WAM Password Stored in SessionStorage:**
- Issue: WAM API password stored in browser sessionStorage, visible in developer tools
- Files: `src/pages/admin/AdminSettingsPage.tsx`, `src/hooks/useWamApi.ts`
- Impact: Not suitable for production credentials, users can accidentally leak via screenshots, session hijacking exposes credentials
- Fix approach: Use secure cookie (httpOnly, secure flags) or Clerk custom JWT claims; rotate WAM credentials; add CSP headers to restrict devtools access

**HTML Sanitization Missing on AI Responses:**
- Issue: AI-generated markdown converted to HTML via `dangerouslySetInnerHTML` with simple regex replacements, no sanitization
- Files: `src/components/admin/sales-targets/SalesAISearch.tsx` (line 137-144)
- Impact: XSS vulnerability if AI generates malicious HTML, user data could be exposed
- Fix approach: Use a markdown sanitizer library (e.g., `markdown-it` with sanitization plugin or `remark-sanitize`); validate HTML before rendering

**Console Logging in Production Code:**
- Issue: 43 instances of `console.error`, `console.log` throughout codebase
- Files: `src/hooks/useSupabaseVendorData.ts` (multiple), `src/pages/VendorsV2.tsx`, `src/components/` (widespread)
- Impact: Sensitive data may leak to browser console/analytics, adds noise to logs, inconsistent debugging approach
- Fix approach: Implement proper logging abstraction; strip console logs in production builds; use error tracking service (e.g., Sentry) for errors

## Known Bugs

**Multiple Database RPC Fallbacks Masking Root Cause:**
- Symptoms: Silent failures when RPCs don't exist, cascading fallback logic takes unpredictable paths
- Files: `src/hooks/useSupabaseVendorData.ts` (lines 110-152 for fetchVendorPulseFeed, similar pattern in fetchVendorProfile)
- Trigger: Call `fetchVendorPulseFeed` when newer RPC versions not available, error details lost in fallback chain
- Workaround: Check database logs separately; impossible to determine which RPC succeeded from client code
- Impact: Hard to debug which version client is using, inconsistent behavior if migrations are partial

**Pagination with Unbounded Page Size (500-1000 records per page):**
- Symptoms: Memory spikes and slow rendering when loading full category vendor index
- Files: `src/pages/VendorsV2.tsx` (lines 162, 201, 641 with `pageSize: 500`)
- Trigger: User navigates to category with large dataset, `fetchAllCategoryVendorIndex` loads all categories at once
- Workaround: Browser may become unresponsive; workaround is to filter by category first
- Impact: Poor performance for vendors with >50k mentions, out-of-memory errors on lower-end devices

**Race Condition in URL Sync Cancellation:**
- Symptoms: State updates may continue after component unmount if URL param changes during navigation
- Files: `src/pages/VendorsV2.tsx` (lines 415-454, 535-573)
- Trigger: User rapidly changes URL params, component unmounts, then async effects complete and try to setState
- Workaround: None; relies on `cancelled` flag but timing is unpredictable
- Impact: Memory leak warnings, stale state updates, console errors in edge cases

## Security Considerations

**Missing CSRF Protection on State-Changing Operations:**
- Risk: API calls that modify data (approve mentions, create tasks) don't use CSRF tokens, only Clerk JWT
- Files: `src/hooks/useVendorQueue.ts`, `src/components/admin/` (mutation handlers)
- Current mitigation: Relies on JWT verification and RLS in Supabase; Supabase Edge Functions verify JWT
- Recommendations: Add CSRF tokens to state-changing requests; implement idempotency keys for sensitive mutations

**Unsafe Deserialization of JSON from Edge Functions:**
- Risk: AI responses parsed with `JSON.parse` without schema validation before use
- Files: `src/hooks/useVendorQueue.ts` (line 65 `parseAIResponse`), `src/components/admin/chat/AIChatBox.tsx`
- Current mitigation: Basic try-catch, returns null on parse failure
- Recommendations: Use Zod schema for validation, define strict response types from Edge Functions

**Insufficient Input Validation on Search and Filter Parameters:**
- Risk: Search queries and category filters passed directly to RPC calls without validation
- Files: `src/pages/VendorsV2.tsx` (lines 507-511), `src/hooks/useSupabaseVendorData.ts` (fetchVendorPulseFeed)
- Current mitigation: RLS handles visibility, but no validation prevents injection attacks
- Recommendations: Use Zod for query parameter validation; whitelist acceptable values for filters

**Exposed API URLs and Configuration in Frontend:**
- Risk: WAM API URL stored in `src/config/wam.ts` and vite env vars, visible in compiled JS
- Files: `src/config/wam.ts`, `src/components/admin/sales-targets/SalesAISearch.tsx` (line 5)
- Current mitigation: Uses anonymized Supabase Edge Functions for some operations, WAM requires password header
- Recommendations: Move API configuration to backend gateway; use CSP to restrict API origins; add rate limiting at backend

## Performance Bottlenecks

**Massive Pagination Loop in Category Index Loading:**
- Problem: `fetchAllCategoryVendorIndex` fetches all mentions 500 at a time in while loop, can make dozens of RPC calls
- Files: `src/pages/VendorsV2.tsx` (lines 197-239)
- Cause: No aggregation on backend, client must paginate through entire dataset to count vendors per category
- Improvement path: Add new RPC that returns aggregated vendor counts per category in single call; cache aggressively; consider background refresh

**Multiple Full-Dataset Index Loads on Mount:**
- Problem: `fetchAllCategoryVendorIndex`, `fetchVendorCountsIndex`, and `fetchVendorsList` all load complete datasets on component mount
- Files: `src/pages/VendorsV2.tsx` (useEffect blocks at lines 576, 535, 609)
- Cause: Required for category pills, sidebar, and search autocomplete, but blocks rendering
- Improvement path: Lazy-load indexes only when needed; implement cursor-based pagination; use service worker for background sync

**26 useEffect Hooks in Single Page Component:**
- Problem: `VendorsV2.tsx` has excessive useEffect chaining with complex dependencies, difficult to reason about execution order
- Files: `src/pages/VendorsV2.tsx` (1754 lines with 26 useEffect calls)
- Cause: Multiple data sources (Supabase, cache, filters, URL params) managed separately
- Improvement path: Extract state into custom hook, consolidate dependent effects, use Zustand or Jotai for global state

**Logo Fetch via API for Every Vendor Card:**
- Problem: `getVendorLogoUrl` constructs img.logo.dev URLs at render time for each vendor without memoization
- Files: `src/pages/VendorsV2.tsx` (lines 249-279), used in hundreds of card renders
- Cause: No caching of logo URLs, logo.dev API called even if same vendor appears multiple times
- Improvement path: Memoize logo URLs by vendor name; batch fetch logos on mount; use local image cache

## Fragile Areas

**VendorsV2.tsx Component - Complex State Management:**
- Files: `src/pages/VendorsV2.tsx`
- Why fragile: 1754-line component with 20+ state variables, 26 useEffect hooks, 4 useRef caches, manages URL sync + data fetching + filtering + AI context + search autocomplete in single component
- Safe modification: Extract into smaller components (FilterPanel, VendorGrid, AIContextBuilder); move caching logic to custom hook; use state management library
- Test coverage: No unit tests, E2E coverage likely incomplete for all filter + pagination combinations

**Supabase RPC Versioning and Fallback Chain:**
- Files: `src/hooks/useSupabaseVendorData.ts`
- Why fragile: Three-level fallback (v3 → v2 → legacy) for each major RPC, assumptions about version availability undocumented
- Safe modification: Document which versions are available in which environments; add explicit version checks; create a single "call best available version" function
- Test coverage: No tests for fallback behavior, unclear which version is actually used in production

**Admin Settings WAM Password Section:**
- Files: `src/pages/admin/AdminSettingsPage.tsx` (lines 35-73)
- Why fragile: Direct sessionStorage access, no validation, no expiration, no audit logging
- Safe modification: Implement token management abstraction, add audit logging, use secure cookies, add expiration UI
- Test coverage: No tests for session persistence, error recovery

**AI Response Rendering with dangerouslySetInnerHTML:**
- Files: `src/components/admin/sales-targets/SalesAISearch.tsx` (lines 137-146)
- Why fragile: Regex-based HTML generation is unpredictable, could break with different markdown patterns from AI
- Safe modification: Use `react-markdown` or `markdown-it` library; add schema validation for response structure
- Test coverage: No tests for different response formats, no fuzzing of AI output

## Scaling Limits

**Database RPC Call Volume:**
- Current capacity: ~1 RPC call per page load for mentions, unbounded pagination in loops
- Limit: At ~20 concurrent users fetching full category index simultaneously, could generate 100+ RPC calls/second
- Scaling path: Implement RPC call batching, add result caching in Supabase cache layer, implement client-side request deduplication

**Memory Usage in Browser for Large Datasets:**
- Current capacity: Safe for datasets up to ~5000 mentions in memory at once
- Limit: Category index fetching can accumulate 50k+ mention objects in browser memory, causing slowness/crashes
- Scaling path: Implement virtual scrolling for lists, move aggregation to backend, stream large datasets instead of loading all at once

**Vendor Logo API Rate Limiting:**
- Current capacity: Unclear, logo.dev token used for all requests, rate limits not enforced client-side
- Limit: If N vendors × M page renders × K impressions, could hit logo.dev rate limits
- Scaling path: Implement request queuing, use local image cache, batch logo requests, fallback to monogram generator

## Dependencies at Risk

**React Query without Automatic Stale Refetch on Window Focus:**
- Risk: Data may be stale for long user sessions, cache never refreshes automatically
- Files: `src/hooks/useSupabaseVendorData.ts`, `src/hooks/useVendorQueue.ts` (useQuery without `refetchOnWindowFocus`)
- Impact: Users may see outdated vendor intel, changes from other admin users not reflected
- Migration plan: Enable `refetchOnWindowFocus` in React Query config, add background refresh polling

**Playwright E2E Tests Only, No Unit Tests:**
- Risk: Complex hooks and utility functions untested, changes to core logic can break without detection
- Files: No `.test.ts` or `.spec.ts` files found in src/
- Impact: Refactoring is risky, bugs introduced in utility functions only caught during manual testing
- Migration plan: Add Vitest configuration, write unit tests for hooks, data transformations, and utility functions first

**Shadcn/ui Version Pinning at ^1.x:**
- Risk: Shadcn components are copy-pasted, updates must be manual and may diverge between components
- Files: `src/components/ui/` (all shadcn components)
- Impact: Security updates slow to apply, inconsistencies between component versions
- Migration plan: Consider monorepo dependency or build shadcn components from source, document update process

## Missing Critical Features

**No Error Boundary for Graceful Degradation:**
- Problem: Single component error can crash entire page, no fallback UI
- Blocks: Cannot safely add complex features without risk of cascading failures
- Implementation: Add React Error Boundary wrapper around pages, implement fallback UI for common error types

**No Offline Support or Fallback Data:**
- Problem: Network failures result in empty state, no cached data shown to user
- Blocks: Features that require real-time data cannot work on flaky connections
- Implementation: Add service worker, implement local cache with IndexedDB, queue mutations offline

**No Feature Flags or A/B Testing Infrastructure:**
- Problem: New features go live immediately, no gradual rollout or user segment testing
- Blocks: Cannot test with subset of users, cannot easily roll back broken features
- Implementation: Integrate feature flag service (LaunchDarkly, Unleash), add user cohort support

**No Rate Limiting or Request Deduplication Client-Side:**
- Problem: Rapid user actions (clicking filter, search) generate duplicate RPC calls
- Blocks: Cannot effectively scale to higher user counts without backend overload
- Implementation: Add request deduplication via queryFn signature, debounce search, add loading states to prevent double-clicks

## Test Coverage Gaps

**No Tests for Complex State Transitions:**
- Untested area: URL param sync, filter state, pagination state in VendorsV2.tsx
- Files: `src/pages/VendorsV2.tsx` (lines 415-488)
- Risk: Refactoring filter logic could break browser back button or initial deep linking
- Priority: High (user navigation depends on this)

**No Tests for Supabase RPC Fallback Logic:**
- Untested area: Version detection and fallback between v3/v2/legacy RPCs
- Files: `src/hooks/useSupabaseVendorData.ts` (fetchVendorPulseFeed, fetchVendorProfile, others)
- Risk: Undetected breaking changes if RPC names change or new versions unavailable
- Priority: High (critical data pipeline)

**No Tests for Error Conditions:**
- Untested area: Network errors, RPC timeouts, malformed responses from Edge Functions
- Files: All data-fetching hooks lack error scenario testing
- Risk: Unknown behavior on network failures, error states not validated
- Priority: Medium (affects UX but detected quickly in practice)

**No Tests for Permission and Tier-Based Access:**
- Untested area: Free vs Pro vs Admin user access to data
- Files: `src/utils/tierUtils.ts`, `src/components/vendors/VendorCardDetail.tsx` (redaction logic)
- Risk: Tier-restricted data visible to unpaid users, or paid features blocked incorrectly
- Priority: Critical (security/billing issue)

**No Tests for Search and Filter Combinations:**
- Untested area: Combining category + search + type filter, ensuring counts match mentions
- Files: `src/pages/VendorsV2.tsx` (filter application), `src/hooks/useVendorFilters.ts`
- Risk: Inconsistent counts, missing results, or incorrect filtering logic undetected
- Priority: Medium (affects UX, visible in testing)

---

*Concerns audit: 2026-04-13*
