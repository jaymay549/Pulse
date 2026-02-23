---
shaping: true
---

# CDG Pulse V1 — Shaping

## Requirements (R)

| ID | Requirement | Status |
|----|-------------|--------|
| R0 | Members can research vendors using real peer insights before committing | Core goal |
| R1 | Members can discover alternatives/competitors to any vendor they're viewing | Must-have |
| R2 | Tier-gated access: free members see limited data, pro members see full insights | Must-have |
| R3 | Vendors can self-initiate a claim request on their own profile page | Must-have |
| R4 | Claim requests require admin approval before vendor gains verified access | Must-have |
| R5 | Verified vendors can respond to individual mentions on their profile | Must-have |
| R6 | Verified vendors see structured market intel: own metrics vs competitor metrics side-by-side | Core goal (vendor) |
| R7 | Verified vendor's profile page transforms into their management dashboard when logged in | Must-have |
| R8 | Billing is flat fee, manually processed via Stripe — no automated billing UI in V1 | Must-have |

---

## What Already Exists

| Area | Already Built |
|------|--------------|
| Vendor feed | Grid + filters, AI theme summaries (pro-gated with blur) |
| Vendor profiles | Full page: mentions, sentiment, trends, compared vendors, AI chat |
| WhatsApp pipeline | WAM → AI extraction → admin approval queue |
| User tiers | free / pro / executive / viewer / verified_vendor / admin (Clerk + Supabase) |
| Vendor responses | `vendor_responses` table, `useVendorResponses` hook, `VendorResponseSection` component |
| Vendor profiles table | `vendor_profiles`: user_id → vendor_name, is_approved boolean, RLS policies |
| Vendor ownership hooks | `useVendorAuth`, `useVerifiedVendor` — reads Clerk org metadata |
| Vendor enrichment | Firecrawl edge function: logo, website, tagline, banner |
| Compared vendors RPC | `get_compared_vendors()` returns top co-occurrence + category peers |
| Admin dashboard | 13+ pages including queue, settings, members, tasks, prompts |

---

## Spikes

### S1 — Clerk Role-Setting Mechanism

**Finding:** No programmatic mechanism exists to update Clerk user metadata from the app.
Only `@clerk/clerk-react` (publishable key) is installed — no secret key, no backend SDK.
Tier is read from `user.publicMetadata.circles.tier` ([useClerkAuth.ts:22](../src/hooks/useClerkAuth.ts)).

**Resolution for V1:** Admin approves claims in-app (sets `vendor_profiles.is_approved = true`);
admin manually updates Clerk org metadata in Clerk dashboard as a separate manual step.
Consistent with manual billing approach — no new edge function needed.

### S2 — Vendor Ownership Association

**Finding:** Two parallel systems exist:
1. **Supabase `vendor_profiles`** — links `user_id → vendor_name`, `is_approved` boolean, RLS-enforced
2. **Clerk org metadata** — `org.publicMetadata.vendor.vendorNames[]` — used by `useVendorAuth` / `useVerifiedVendor`

These are not synchronized. The dashboard ownership gate will use `vendor_profiles` (Supabase)
directly via RLS, avoiding Clerk org metadata dependency for V1.

---

## Shape A: Profile-as-Dashboard, Vendor-first V1

| Part | Mechanism | Flag |
|------|-----------|:----:|
| **A1** | **Vendor claim flow** | |
| A1.1 | New `vendor_claims` table: claimant name, email, vendor being claimed, note, status (pending/approved/rejected) | |
| A1.2 | Claim form on `VendorProfile` — visible when no approved `vendor_profiles` row exists for this vendor AND current user hasn't already claimed it; inserts to `vendor_claims` | |
| **A2** | **Admin claim approval** | |
| A2.1 | New `/admin/claims` page listing pending `vendor_claims` with approve/reject actions | |
| A2.2 | Approve: creates `vendor_profiles` row (`user_id = claimant_id`, `vendor_name`, `is_approved = true`); admin manually sets Clerk org metadata in Clerk dashboard as V1 manual step | |
| **A3** | **Vendor dashboard transformation** | |
| A3.1 | `VendorProfile` queries `vendor_profiles` via RLS: `WHERE user_id = auth.uid() AND vendor_name = :slug AND is_approved = true`; if row exists, renders dashboard tabs | |
| A3.2 | Dashboard renders three tabs above public profile: Overview (own stats), Respond (reply to mentions), Intel (market comparison) | |
| **A4** | **Respond to reviews** | |
| A4.1 | Reply composer per mention, visible to verified vendor owner only; writes to existing `vendor_responses` table | |
| A4.2 | Leverages existing `useVendorResponses` hook and `VendorResponseSection` component | |
| **A5** | **Market intel panel** | |
| A5.1 | New `VendorIntelPanel` component: reads `get_compared_vendors()` RPC, renders own vs competitor sentiment %, mention volume, and top themes in a structured comparison table | |
| **A6** | **Member discovery CTAs** | |
| A6.1 | Rename "Compared Vendors" → "Alternatives & Competitors"; add "See all [category] →" CTA linking to `/vendors?category=X` | |

---

## Fit Check: R × A

| Req | Requirement | Status | A |
|-----|-------------|--------|---|
| R0 | Members can research vendors using real peer insights before committing | Core goal | ✅ |
| R1 | Members can discover alternatives/competitors to any vendor they're viewing | Must-have | ✅ |
| R2 | Tier-gated access: free members see limited data, pro members see full insights | Must-have | ✅ |
| R3 | Vendors can self-initiate a claim request on their own profile page | Must-have | ✅ |
| R4 | Claim requests require admin approval before vendor gains verified access | Must-have | ✅ |
| R5 | Verified vendors can respond to individual mentions on their profile | Must-have | ✅ |
| R6 | Verified vendors see structured market intel: own metrics vs competitor metrics side-by-side | Core goal (vendor) | ✅ |
| R7 | Verified vendor's profile page transforms into their management dashboard when logged in | Must-have | ✅ |
| R8 | Billing is flat fee, manually processed via Stripe — no automated billing UI in V1 | Must-have | ✅ |

**Shape A selected. All requirements pass. No flagged unknowns remaining.**

---

## Out of Scope (V1)

- Automated Stripe billing flow (manual Stripe processing only)
- Programmatic Clerk role updates (manual Clerk dashboard step)
- Raw competitor mention text in vendor intel
- Vendor-initiated enrichment (admin controls this)
- New member discovery UI beyond CTAs and Compared Vendors improvements
