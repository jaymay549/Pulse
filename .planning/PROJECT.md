# Vendor Tiering System

## What This Is

A vendor authentication and tiering system for CDG Pulse. Vendors authenticate via Supabase magic link (separate from the existing Clerk-based dealer/admin auth) and access a tiered vendor dashboard. The sales team creates vendor credentials through the admin panel after closing deals.

## Core Value

Vendors can securely log in via magic link and see only the data their tier permits — separate from dealer auth, managed by the sales team.

## Requirements

### Validated

- [x] Vendor auth via Supabase magic link (separate from Clerk) — Validated in Phase 1: Vendor Auth Primitives
- [x] Vendor session management and protected routes — Validated in Phase 1: Vendor Auth Primitives
- [x] Nav button for vendor login (next to admin, for testing) — Validated in Phase 1: Vendor Auth Primitives
- [x] Vendors land on existing /vendor-dashboard after auth — Validated in Phase 1: Vendor Auth Primitives

### Active
- [ ] Admin panel: create vendor login credentials
- [ ] Admin panel: match vendor to existing vendor profile
- [ ] Admin panel: set vendor tier (Unverified / Tier 1 / Tier 2)
- [ ] Admin panel: visual tier status identification
- [ ] Tier 1 gating: market intel, leaderboard by positivity/ranking (view-only, $12K)
- [ ] Tier 2 gating: all T1 + granular insights, mentions, action plans ($25K)
- [ ] Row-Level Security policies for tier-based data access

### Out of Scope

- Self-serve vendor registration — sales team creates all credentials
- Vendor password-based login — magic link only
- Mobile app vendor experience — web only
- Vendor billing/payments integration — handled outside the platform

## Context

- **Existing auth:** Clerk handles dealer/admin auth via JWT tokens passed to Supabase
- **New auth:** Supabase Auth (magic link) for vendors — completely parallel system
- **Vendor dashboard:** Already exists at `/vendor-dashboard` with vendor-specific components
- **Admin panel:** Exists at `/admin/*` with AdminGuard + AdminLayout
- **Tier pricing:** T1 = $12K (view-only intel), T2 = $25K (full insights + actionable data)
- **Linear issues:** CAR-7 (auth), CAR-8 (admin tools), CAR-9 (tier gating RLS)
- **Database:** vendor_profiles, vendor_metadata, vendor_reviews already exist in public schema

## Constraints

- **Auth separation**: Vendor auth must not interfere with existing Clerk auth flow
- **Supabase magic link**: Use Supabase Auth's built-in magic link — no custom email infrastructure
- **Brownfield**: Must integrate with existing codebase patterns (React 18, TypeScript, TanStack Query, shadcn/ui)
- **RLS**: Tier gating enforced at database level via Row-Level Security, not just frontend

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Supabase Auth for vendors (not Clerk) | Vendors need a separate identity system; Supabase magic link is simpler for managed credentials | — Pending |
| Magic link only (no password) | Sales team creates credentials; vendors just click a link — simpler UX | — Pending |
| Phased rollout (auth → admin → RLS) | Each piece is independently valuable and testable | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-13 after Phase 1 completion*
