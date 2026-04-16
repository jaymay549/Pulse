# Coding Conventions

**Analysis Date:** 2026-04-13

## Naming Patterns

**Files:**
- React components: PascalCase, e.g., `AdminGuard.tsx`, `VendorCard.tsx`
- Custom hooks: camelCase with `use` prefix, e.g., `useClerkAuth.ts`, `useAdminGroups.ts`
- UI components (shadcn): kebab-case, e.g., `smart-search-bar.tsx`, `phone-input.tsx`
- Utilities: camelCase, e.g., `tierUtils.ts`, `accessControl.ts`, `markdown.tsx`
- Type definition files: PascalCase, e.g., `admin.ts`, `sales-targets.ts`

**Functions:**
- React components: PascalCase, e.g., `AdminGuard`, `VendorIntelSection`
- Custom hooks: PascalCase with `use` prefix, e.g., `useClerkAuth`, `useAdminGroups`
- Utility functions: camelCase, e.g., `isProUser()`, `getAccessLevel()`, `isPaidTier()`
- Event handlers: camelCase with verb prefix, e.g., `handleSubmit`, `onSuccess`, `onChatIdChange`

**Variables:**
- Constants: UPPER_SNAKE_CASE, e.g., `MAX_POLL_ATTEMPTS`, `POLL_INTERVAL`, `RETRYABLE_STATUSES`
- React state: camelCase, e.g., `current`, `showGainAccess`, `loading`
- Component props: camelCase, e.g., `initialChatId`, `onChatIdChange`, `onSuccess`
- Type/Interface properties: camelCase or snake_case matching database schema, e.g., `vendor_name`, `group_id`

**Types:**
- Interfaces/Types: PascalCase with descriptive suffix, e.g., `ChatMessage`, `WhatsAppGroup`, `VendorQueueItem`
- Type unions: PascalCase, e.g., `QueueStatus`, `TopicStatus`, `TaskStatus`
- Generic props interfaces: PascalCase with `Props` suffix, e.g., `AIChatBoxProps`, `AdminGuardProps`
- Enum-like type unions: "word1" | "word2" format in lowercase, e.g., `"pending" | "processing" | "processed"`

## Code Style

**Formatting:**
- No dedicated Prettier config detected. Format follows React/TypeScript conventions.
- Indent: 2 spaces (inferred from codebase)
- Line length: No strict limit observed; some lines exceed 120 characters
- Semicolons: Required at end of statements
- Trailing commas: Used in objects, arrays, and function parameters

**Linting:**
- Tool: ESLint (eslint.config.js with flat config format)
- Key settings:
  - `@typescript-eslint/no-unused-vars`: OFF (permissive, unused vars allowed)
  - `react-refresh/only-export-components`: WARN (allows non-component exports with `allowConstantExport`)
  - React hooks rules: enforced via `eslint-plugin-react-hooks`
- TypeScript: Strict mode disabled
  - `noImplicitAny: false` — implicit any types allowed
  - `strictNullChecks: false` — null/undefined not strictly checked
  - `noUnusedLocals: false` — unused local variables allowed
  - `noUnusedParameters: false` — unused parameters allowed

## Import Organization

**Order:**
1. React imports and hooks (`import React`, `import { useState }`)
2. Third-party library imports (`react-router-dom`, `@clerk/clerk-react`, `lucide-react`, etc.)
3. Supabase and integrations (`@supabase/supabase-js`, custom Supabase client)
4. UI component imports (`@/components/ui/*`)
5. Custom hooks (`@/hooks/*`)
6. Custom component imports (`@/components/*` excluding ui)
7. Type/interface imports (`type { TypeName }`)
8. Utility imports (`@/utils/*`, `@/lib/*`)
9. Asset imports (`@/assets/*`)

**Path Aliases:**
- `@/` maps to `src/`
- Configured in `vite.config.ts` and `tsconfig.json`
- Always use `@/` prefix for project imports, never relative paths like `../../../`

**Example (from VendorProfile.tsx):**
```typescript
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Globe, ... } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useClerkAuth } from "@/hooks/useClerkAuth";
import { fetchVendorProfile, type VendorTrendResult } from "@/hooks/useSupabaseVendorData";
import { isProUser } from "@/utils/tierUtils";
import { cn } from "@/lib/utils";
```

## Error Handling

**Patterns:**
- Errors thrown from async functions via `throw error`
- Errors logged with context prefix: `console.error("[Service] operation error:", error)`
- Service function pattern: return normalized result object or throw
- React Query integration: errors thrown in `queryFn` are automatically caught by React Query
- No global error boundary detected; errors propagate to component level

**Example (from useSupabaseVendorData.ts):**
```typescript
if (legacy.error) {
  console.error("[Supabase] get_vendor_pulse_feed_v3/v2 + legacy fallback error:", legacy.error);
  throw legacy.error;
}
```

**Service functions pattern:**
- Direct function calls throw on error
- React Query wrapped functions: errors captured in error state and queryFn throws
- WAM API calls via `useWamApi()` hook handle auth via `X-Password` header

## Logging

**Framework:** `console` methods (no dedicated logger)

**Patterns:**
- Error logs: `console.error("[Context] message:", error)` with service/location prefix in brackets
- Prefix format: `[ServiceName]` or `[FunctionName]` for context
- Errors logged at point of failure, not propagated silently
- No info/debug logging observed in analyzed files; logs are error-focused

**Example (from multiple hooks):**
```typescript
console.error("[Supabase] get_vendor_profile_v3/v2 + legacy fallback error:", legacy.error);
console.error("[WAM] failed_operation error:", error);
```

## Comments

**When to Comment:**
- JSDoc/TSDoc: Used for utility functions and type documentation
- Inline comments: Minimal; used only where logic is non-obvious
- Section headers: `// ── Section Name ──` pattern used in type files (e.g., `admin.ts`)
- Sample data: Documented inline, e.g., `// Sample examples for the preview`

**JSDoc/TSDoc:**
- Used on exported utility functions: `/** * Description * */`
- Used on public hook functions
- Type definitions include descriptions via JSDoc comments
- Example (from tierUtils.ts):
```typescript
/**
 * Check if a user tier has Pro-level access
 * Pro tier includes: pro, executive, viewer, verified_vendor
 */
export function isProUser(tier: string | null | undefined): boolean {
```

## Function Design

**Size:** 
- Most functions stay under 100 lines
- Larger components split into subcomponents, e.g., `VendorCard` extracted from main page
- Average hook: 20-60 lines
- Pages: 100-1700+ lines (large pages delegate to subcomponents)

**Parameters:**
- Prefer named parameters object for functions with >2 params
- React component props: always destructured as single props parameter
- Optional parameters: marked with `?` in types, not `undefined` union
- Example (from useClerkAuth):
```typescript
export const useClerkAuth = () => {
  // No parameters; returns object with auth state and methods
  return {
    isLoading, isAuthenticated, user, tier, role, isAdmin, getToken, fetchWithAuth
  };
}
```

**Return Values:**
- Utility functions: return typed result or throw
- React hooks: return state object with properties
- Query functions: return normalized data or throw
- Mutable functions: return mutationFn result or void, errors thrown
- Example (from useAdminGroups):
```typescript
return useMutation({
  mutationFn: async ({ id, monitored }: { id: number; monitored: boolean }) => {
    // Void mutationFn, throws on error
  },
  onSuccess: () => {
    // Cache invalidation in onSuccess
  }
});
```

## Module Design

**Exports:**
- Hooks: exported as named exports (not default), e.g., `export function useClerkAuth()`
- Components: exported as default or named, both patterns used
- Types: exported as named exports with `export type` or `export interface`
- Constants: exported as named exports
- Example (from admin.ts type file):
```typescript
export type QueueStatus = "pending" | "processing" | "processed" | "failed";
export interface VendorQueueItem { ... }
export const VENDOR_DIMENSIONS: Record<string, { label: string; icon: string }> = { ... };
```

**Barrel Files:**
- Used for component groupings: `src/components/vendors/index.ts`
- Pattern: re-export all public components from subdirectory
- Example (vendors/index.ts):
```typescript
export { VendorCard } from "./VendorCard";
export { FilterBar } from "./FilterBar";
export { VendorMention } from "./VendorMention";
```
- No barrel files in hooks or utils directories; direct imports used

## Multi-Backend Architecture Patterns

**Supabase Client:**
- Imported as: `import { supabase } from "@/integrations/supabase/client"`
- Auto-generated types: `src/integrations/supabase/types.ts`
- RPC calls: `supabase.rpc("function_name", { p_param: value })`
- Schema selection: `supabase.schema("wam" as any)` for WAM schema access
- JWT Auth: Handled automatically via Clerk integration

**WAM API:**
- Accessed via `useWamApi()` hook
- Auth: `X-Password` header from `sessionStorage.getItem("wam_password")`
- Base URL: configured in `src/config/wam.ts`
- Fallback: direct WAM API calls if not available

**React Query Integration:**
- Query key pattern: string array, e.g., `["admin-groups"]`, `["group-messages", groupId]`
- Invalidation: `queryClient.invalidateQueries({ queryKey: ["admin-groups"] })`
- Enabled queries: `enabled: !!groupId` pattern for conditional queries
- Stale time: set on queries that cache well, e.g., `staleTime: 5 * 60 * 1000`

---

*Convention analysis: 2026-04-13*
