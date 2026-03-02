# Tech Stack Profile — Feature Design

## Purpose

Structured first-party data collection from dealers about which CRM/DMS vendors they use, their satisfaction, switching intent, and reasons for leaving. Dealers fill out a profile and receive a Market Intelligence Report as the value exchange. The data feeds back into vendor dashboard intelligence (switching intel, prospective churn, sentiment).

## Database Schema

### `user_tech_stack`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | uuid | PK, default gen_random_uuid() | |
| `user_id` | uuid | FK → profiles(id), NOT NULL | The dealer |
| `vendor_id` | uuid | FK → vendor_metadata(id), NOT NULL | Normalized vendor reference |
| `is_current` | boolean | NOT NULL, default true | Currently using this vendor |
| `sentiment_score` | integer | CHECK (1-10), nullable | Satisfaction rating |
| `switching_intent` | boolean | NOT NULL, default false | Actively exploring alternatives |
| `status` | text | NOT NULL, CHECK in ('stable','exploring','left') | Current relationship status |
| `insight_text` | text | nullable | Optional free-text elaboration |
| `confirmed_at` | timestamptz | nullable | Last "still accurate?" confirmation |
| `created_at` | timestamptz | NOT NULL, default now() | |
| `updated_at` | timestamptz | NOT NULL, default now() | |

- Unique constraint on `(user_id, vendor_id)` — one entry per dealer per vendor.
- RLS: dealers can only read/write their own rows (`auth.uid() = user_id`).

### `user_tech_stack_exit_reasons`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | uuid | PK, default gen_random_uuid() | |
| `tech_stack_id` | uuid | FK → user_tech_stack(id) ON DELETE CASCADE, NOT NULL | Parent entry |
| `reason_category` | text | NOT NULL, CHECK in ('pricing','support','features','reliability','integration','other') | Structured reason |
| `detail_text` | text | nullable | Optional elaboration |
| `created_at` | timestamptz | NOT NULL, default now() | |

- One-to-many: a dealer can cite multiple reasons for leaving/exploring away from a vendor.
- Same table serves both historical exits (`is_current = false`) and prospective churn (`is_current = true, status = 'exploring'`). The parent row's `is_current` flag disambiguates.
- RLS: inherits access from parent `user_tech_stack` row via join.

### `user_submitted_vendors`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | uuid | PK, default gen_random_uuid() | |
| `submitted_by` | uuid | FK → profiles(id), NOT NULL | Dealer who added it |
| `vendor_name` | text | NOT NULL | Free-text name |
| `website_url` | text | nullable | Optional URL |
| `status` | text | NOT NULL, default 'pending', CHECK in ('pending','approved','rejected') | Admin review status |
| `matched_vendor_id` | uuid | FK → vendor_metadata(id), nullable | Linked after admin approval |
| `created_at` | timestamptz | NOT NULL, default now() | |

- "Can't find your vendor?" fallback during wizard Step 1.
- Admin reviews and either matches to existing `vendor_metadata` or creates a new entry.
- Dealer's `user_tech_stack` row initially references a temporary ID; updated to real `vendor_id` after admin match.

## Wizard Flow

Three-step linear wizard. Progress saves on each step transition (not just final submit). If a dealer abandons mid-wizard, partial data persists and they see a "Continue" CTA.

### Step 1: Current Stack

1. Dealer searches vendors via combobox (backed by `vendor_metadata`).
2. If vendor not found → "Can't find it? Add it" inline form (name + optional URL) → creates `user_submitted_vendors` row.
3. For each selected vendor, set status:
   - **Stable** — happy, not looking to switch.
   - **Exploring** — actively considering alternatives.
4. If `exploring` → expand structured reason picker: pricing, support, features, reliability, integration, other. Multiple selections allowed.
5. Save all entries as `user_tech_stack` rows with `is_current: true`.

### Step 2: The Ex-Factor

1. Same vendor search interface.
2. For each former vendor selected, pick reason categories for leaving (same list as Step 1's exploring reasons). Multiple selections allowed.
3. Optional detail text per vendor.
4. Save as `user_tech_stack` rows with `is_current: false, status: 'left'`.

### Step 3: Rate & Reflect

1. Display all vendors added in Steps 1 and 2.
2. For each: sentiment score slider (1-10).
3. Optional insight text field per vendor.
4. Submit → mark profile complete.

## Progress Bar

- Persistent in the app's top bar (global layout).
- Visible to dealers who have not completed their profile (or whose profile needs reconfirmation).
- Shows completion percentage calculated client-side:
  - All current vendors added and status set → partial credit.
  - All exit reasons filled for exploring/left vendors → partial credit.
  - All sentiment scores provided → partial credit.
  - 100% = every field on every vendor entry is filled.
- The incomplete state in the top bar IS the nudge. No popups, no browsing triggers.
- At 100%: bar transforms into "View Your Market Intelligence Report" CTA.

## Completion Calculation

Completion is binary for the reward (0% or 100%), but the progress bar shows granular progress to guide the dealer through what's missing.

Required for 100%:
- At least 1 current vendor added.
- Status set on every current vendor.
- Exit reasons provided for every `exploring` or `left` vendor.
- Sentiment score (1-10) on every vendor (current + former).

Optional (does not block completion):
- Insight text.
- Detail text on exit reasons.
- Website URL on submitted vendors.

## Market Intelligence Report

Unlocks at 100% completion. Single page/modal with three sections:

### Section A: "Your Stack vs. Peers"

For each current vendor, show:
- Vendor's health score (from `vendor_metric_scores`).
- Category benchmark median (from `category_benchmarks`).
- Side-by-side bar comparison (reuse `MetricsBenchmarkChart` visual pattern).
- Percentile rank in category.

A dealer using a vendor scoring 45/100 in a category averaging 72 immediately sees the gap.

### Section B: "Alternatives Worth Exploring"

Only appears for vendors where `status = 'exploring'`.
- Top 3 vendors in the same category ranked by health score.
- Excludes vendors the dealer already uses or has left.
- Each card highlights the dimension matching their exit reason (e.g., exploring due to `pricing` → show alternative's `value_perception` score).
- Uses existing `vendor_metric_scores` data.

### Section C: "Your Feedback Delivered"

- Confirmation that structured feedback has been anonymously contributed to vendor intelligence dashboards.
- Count: "Your insights are helping improve intelligence for X vendors."
- Closes the value loop — the dealer knows their input matters.

### Gated Content Unlock

After report renders, dealer gains access to deeper data on public vendor profile pages:
- Full `PricingIntelligence` component data.
- Full `SwitchingIntel` component data.
- Content previously gated behind tier restrictions.

## Staleness Prevention

- `confirmed_at` timestamp on each `user_tech_stack` row.
- Set to `now()` on creation and whenever the dealer confirms accuracy.
- After 90 days without confirmation, show a lightweight "Still accurate?" prompt in the top bar (replaces the progress bar position for completed profiles).
- Single "Yes, still accurate" button re-confirms all entries. "Update" button re-opens the wizard with pre-filled data.
- No full re-wizard required for confirmation.

## New RPC Function

### `get_tech_stack_market_report(p_user_id uuid)`

Returns JSON payload:

```json
{
  "is_complete": true,
  "current_vendors": [
    {
      "vendor_name": "VendorX",
      "category": "DMS",
      "status": "exploring",
      "sentiment_score": 4,
      "health_score": 45,
      "category_median": 72,
      "percentile": 25,
      "exploring_reasons": ["pricing", "support"],
      "alternatives": [
        {
          "vendor_name": "VendorY",
          "health_score": 81,
          "highlight_metric": "value_perception",
          "highlight_score": 88
        }
      ]
    }
  ],
  "former_vendors": [
    {
      "vendor_name": "VendorZ",
      "sentiment_score": 3,
      "exit_reasons": ["reliability", "features"]
    }
  ],
  "contribution_count": 5
}
```

## Data Pipeline — Feeding Vendor Intelligence

Tech stack data becomes a second, higher-fidelity source alongside `vendor_mentions`:

| Existing source | New source | Improvement |
|----------------|------------|-------------|
| `vendor_mentions.switching_signal` (NLP-extracted) | `user_tech_stack` with `switching_intent: true` | Structured, self-reported, tied to a real dealer |
| Inferred exit reasons from mention text | `user_tech_stack_exit_reasons.reason_category` | Clean categorical data, directly aggregatable |
| No prospective churn signal | `is_current: true, status: 'exploring'` | Early warning before dealers actually leave |

Vendor dashboard RPC functions (`get_vendor_switching_intel`, `get_vendor_dashboard_intel`) should be updated in a follow-up to incorporate tech stack aggregates.

Minimum anonymity threshold: do not surface tech stack aggregates for a vendor until N+ dealers have reported (same threshold as `category_benchmarks`).

## React Components

### New Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `TechStackWizard` | `src/components/tech-stack/TechStackWizard.tsx` | 3-step modal wizard (Dialog-based) |
| `TechStackStep1` | `src/components/tech-stack/TechStackStep1.tsx` | Current vendor search + status + exploring reasons |
| `TechStackStep2` | `src/components/tech-stack/TechStackStep2.tsx` | Former vendor search + exit reasons |
| `TechStackStep3` | `src/components/tech-stack/TechStackStep3.tsx` | Sentiment scores + insight text |
| `VendorSearchCombobox` | `src/components/tech-stack/VendorSearchCombobox.tsx` | Searchable vendor selector with "add new" fallback |
| `AddVendorInline` | `src/components/tech-stack/AddVendorInline.tsx` | "Can't find it?" inline form (name + URL) |
| `ProfileProgressBar` | `src/components/tech-stack/ProfileProgressBar.tsx` | Top-bar progress indicator |
| `MarketIntelReport` | `src/components/tech-stack/MarketIntelReport.tsx` | The 3-section report page/modal |
| `StackConfirmationPrompt` | `src/components/tech-stack/StackConfirmationPrompt.tsx` | Quarterly "still accurate?" prompt |
| `TechStackProfileCard` | `src/components/tech-stack/TechStackProfileCard.tsx` | Summary card for dealer profile/dashboard |

### New Hooks

| Hook | Purpose |
|------|---------|
| `useTechStackProfile` | CRUD operations for `user_tech_stack` + `exit_reasons` |
| `useTechStackCompletion` | Computes completion percentage from stack entries |
| `useMarketIntelReport` | Calls `get_tech_stack_market_report` RPC |
| `useSubmitVendor` | Handles "can't find vendor" submissions |

### Existing Components Modified

| Component | Change |
|-----------|--------|
| App layout (top bar) | Add `ProfileProgressBar` for incomplete profiles / `StackConfirmationPrompt` for stale profiles |

## UI Patterns

All components use existing shadcn-ui primitives and Tailwind patterns:
- `Dialog` for wizard modal.
- `Command` (combobox) for vendor search.
- `Card`, `Button`, `Badge` for layout.
- `Slider` or segmented control for sentiment 1-10.
- Progress bar uses Tailwind width transitions (consistent with existing metric bars).
- Framer Motion for step transitions within the wizard.

## Implementation Order

1. Supabase migration (tables + RLS + RPC).
2. `useTechStackProfile` and `useTechStackCompletion` hooks.
3. `VendorSearchCombobox` + `AddVendorInline` (shared across steps).
4. Wizard steps 1-3.
5. `TechStackWizard` orchestrator.
6. `ProfileProgressBar` + top bar integration.
7. `useMarketIntelReport` hook + `MarketIntelReport` component.
8. `StackConfirmationPrompt` (staleness).
9. Gated content unlock logic.
10. Vendor dashboard RPC updates (follow-up).
