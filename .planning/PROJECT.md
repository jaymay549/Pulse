# Vendor Tiering System

## What This Is

A vendor authentication and tiering system for CDG Pulse. Vendors authenticate via Supabase magic link (separate from the existing Clerk-based dealer/admin auth) and access a tiered vendor dashboard. The sales team creates vendor credentials through the admin panel after closing deals.

## Core Value

Vendors can securely log in via magic link and see only the data their tier permits — separate from dealer auth, managed by the sales team.

## Current Milestone: v1.1 Admin-Configurable Tier Gating

**Goal:** Make tier visibility admin-configurable (not hardcoded) and implement granular T1/T2/T3 data visibility with partial gating, blurred/locked upgrade CTAs, and a test tier for demos.

**Target features:**
- Admin tier config panel — per-tier toggles for dashboard component visibility
- `tier_component_config` DB table for tier → component mappings
- Partial gating — T1 sees teaser content (top 2 items, leaderboard) with upgrade gates
- Blurred/locked sections — T1 sees gated sections exist with upgrade CTA (not hidden)
- Test tier — admin-configurable for demos/QA
- Dynamic frontend gating — replace hardcoded `T2_ONLY_SECTIONS` with config-driven visibility

**Linear:** CAR-13

## Requirements

### Validated

- ✓ Vendor auth via Supabase magic link (separate from Clerk) — Phase 1
- ✓ Vendor session management and protected routes — Phase 1
- ✓ Nav button for vendor login (next to admin, for testing) — Phase 1
- ✓ Vendors land on existing /vendor-dashboard after auth — Phase 1
- ✓ Admin panel: create vendor login credentials — Phase 2
- ✓ Admin panel: match vendor to existing vendor profile — Phase 2
- ✓ Admin panel: set vendor tier (Unverified / Tier 1 / Tier 2) — Phase 2
- ✓ Admin panel: visual tier status identification — Phase 2
- ✓ RLS policies for tier-based data access (vendor_tier(), auth_vendor_name()) — Phase 3
- ✓ T2-gated RPCs (dimensions, actionable insights, tech stack intel) — Phase 3
- ✓ Frontend T2 section hiding (sidebar + page conditional rendering) — Phase 3
- ✓ Vendor isolation (cross-vendor data access blocked at DB level) — Phase 3
- ✓ Vendor data dedup: duplicate entities merged, names normalized, health check RPC — Phase 7

### Active

- [ ] Admin tier config panel with per-tier component visibility toggles
- [ ] `tier_component_config` table storing tier → component → visible mappings
- [ ] Dynamic frontend gating driven by DB config (replace hardcoded T2_ONLY_SECTIONS)
- [ ] Blurred/locked upgrade CTA for gated sections (not hidden)
- [ ] Partial gating: "What dealers are saying" shows top 2 at T1, "See all" gates to T2
- [ ] Partial gating: competitor leaderboard at T1, "why you rank here" gates to T2
- [ ] Test tier with admin-configurable component mix for demos/QA
- [ ] T1 default visibility per CAR-13 spec (health score, NPS, benchmarking, etc.)
- [ ] T2 unlocks: full action plan, all comments, audience segments, dealer signals, competitive breakdown

### Out of Scope

- Self-serve vendor registration — sales team creates all credentials
- Vendor password-based login — magic link only
- Mobile app vendor experience — web only
- Vendor billing/payments integration — handled outside the platform
- T3 tier implementation — not yet defined; free during 3-month beta
- RLS policy changes for tier_component_config — frontend-only gating layer on top of existing RLS safety net

## Context

- **Existing auth:** Clerk handles dealer/admin auth via JWT tokens passed to Supabase
- **Vendor auth:** Supabase Auth (magic link) for vendors — completely parallel system (shipped v1.0)
- **Vendor dashboard:** 11 sections total; 4 currently T2-gated (mentions, dimensions, dealer-signals, demo-requests), 7 visible to all tiers
- **Admin panel:** Exists at `/admin/*` with vendor management page for provisioning + tier assignment
- **Tier pricing:** T1 = $12K (view-only intel), T2 = $25K (full insights + actionable data), T3 = TBD
- **Linear issues:** CAR-7/8/9 (Done), CAR-13 (this milestone), CAR-24 (demo accounts, depends on test tier)
- **Current gating:** Hardcoded `T2_ONLY_SECTIONS` in sidebar + `isT2` boolean in page — needs to become config-driven
- **RLS safety net:** vendor_tier(), auth_vendor_name(), T2 RPC guards already enforce at DB level — remains unchanged
- **Go-to-market:** Sign ~10 companies at T1 for 1 year, give full T3 access for 3 months, collect feedback, then strip to paid tier

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
*Last updated: 2026-04-16 after Phase 7 (vendor data dedup) completion*
