# Phase 8: Parent/Child Company Filtering - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-23
**Phase:** 08-parent-child-company-filtering-per-product-line-subscription
**Areas discussed:** Subscription data model, Admin provisioning flow, Vendor dashboard product switcher, RPC and data scoping

---

## Subscription Data Model

| Option | Description | Selected |
|--------|-------------|----------|
| New junction table | Create vendor_product_subscriptions linking vendor_logins.id to vendor_product_lines.id with its own tier column. One auth user, multiple subscriptions. | ✓ |
| Extend vendor_logins | Add product_line_id + allow multiple rows per user_id. Changes existing unique constraint. | |
| One login per product line | Separate Supabase Auth user per product line. Total isolation but multiple logins. | |

**User's choice:** New junction table
**Notes:** Clean separation from existing vendor_logins, keeps auth flow intact.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Keep both | vendor_logins.tier stays as account-level default; vendor_product_subscriptions.tier overrides per product line. | ✓ |
| Derive from subscriptions | Remove tier from vendor_logins; account tier = MAX(subscription tiers). | |
| You decide | Claude picks the approach. | |

**User's choice:** Keep both
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Use account-level tier | Backwards compatible fallback for vendors without product subscriptions. | |
| Require at least one subscription | Admin must create at least one product subscription during provisioning. | ✓ |
| Auto-create 'all products' subscription | System auto-creates catch-all subscription at account tier. | |

**User's choice:** Require at least one subscription
**Notes:** None

---

## Admin Provisioning Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Extend existing wizard | Add step to VendorWizardDialog after tier selection for product line assignment. | ✓ |
| Separate management page | Keep wizard simple; manage subscriptions on separate detail page. | |
| Inline on vendor list | Expandable row or sidebar panel in the vendor management table. | |

**User's choice:** Extend existing wizard
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-populate from entity | Wizard auto-loads product lines from selected vendor entity with checkboxes and tier selectors. | ✓ |
| Manual search/add | Admin searches/types product lines one by one. | |
| You decide | Claude picks the approach. | |

**User's choice:** Auto-populate from entity
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, from vendor detail view | Clicking vendor opens detail panel/page for CRUD on subscriptions. | ✓ |
| Yes, re-run wizard | Re-open wizard for existing vendor. | |
| You decide | Claude picks. | |

**User's choice:** Yes, from vendor detail view
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Badge count | Show "3 products" badge next to vendor row, clickable to expand/navigate. | ✓ |
| Inline product chips | Small chips with color-coded tier badges in table row. | |
| You decide | Claude picks. | |

**User's choice:** Badge count
**Notes:** None

---

## Vendor Dashboard Product Switcher

| Option | Description | Selected |
|--------|-------------|----------|
| Dropdown in header | Select dropdown in dashboard header/nav showing active product line name. | ✓ |
| Tab bar below header | Horizontal tabs showing all subscribed product lines. | |
| Sidebar section | Product lines in sidebar with active one highlighted. | |

**User's choice:** Dropdown in header
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| First subscribed product line | Auto-select first product line alphabetically or by creation date. | ✓ |
| Last viewed (persisted) | Remember last viewed via localStorage. | |
| Aggregate view ('All products') | Default to combined data overview. | |

**User's choice:** First subscribed product line
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Individual only | Dropdown shows only subscribed product lines. No aggregate. | ✓ |
| Include 'All products' option | First item shows combined data across all products. | |
| You decide | Claude picks. | |

**User's choice:** Individual only
**Notes:** None

---

## RPC and Data Scoping

| Option | Description | Selected |
|--------|-------------|----------|
| Pass slug from frontend | Frontend passes selected product_line_slug to each RPC call. | ✓ |
| Derive from session context | Store active product line in session variable or JWT claim. | |
| You decide | Claude picks. | |

**User's choice:** Pass slug from frontend
**Notes:** RPCs already accept p_product_line_slug — just stop passing null.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Product-specific tier | Tier gating matches subscription tier for active product line. | ✓ |
| Always use account tier | Component visibility stays same regardless of product line. | |
| Highest of both | MAX(account tier, product tier) for gating. | |

**User's choice:** Product-specific tier
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Update all to pass active slug | Every vendor dashboard component passes the active product line. | ✓ |
| Only update data components | Only data-heavy components pass slug; static ones stay unscoped. | |
| You decide | Claude audits each component. | |

**User's choice:** Update all to pass active slug
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, enforce at RLS level | SECURITY DEFINER function checks vendor_product_subscriptions. Defense in depth. | ✓ |
| Frontend-only enforcement | Dropdown only shows subscribed lines; no backend enforcement. | |
| You decide | Claude picks. | |

**User's choice:** Yes, enforce at RLS level
**Notes:** None

---

## Claude's Discretion

- Table schema details for vendor_product_subscriptions
- RPC function signature changes
- React state management for active product line
- Wizard step UI layout and validation
- Vendor detail panel/page design
- Migration ordering and data backfill strategy

## Deferred Ideas

None — discussion stayed within phase scope
