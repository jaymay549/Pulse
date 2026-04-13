# Phase 2: Admin Provisioning Tools - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-13
**Phase:** 02-admin-provisioning-tools
**Areas discussed:** Provisioning flow, Vendor list display, OTP invite mechanics, Admin sidebar placement

---

## Provisioning Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Single form | One form with email, profile search, tier dropdown | |
| Step-by-step wizard | Multi-step: email → profile → tier → confirm | ✓ |
| Inline row creation | Add row directly in table, spreadsheet-style | |

**User's choice:** Step-by-step wizard
**Notes:** None

---

## Vendor List Display

| Option | Description | Selected |
|--------|-------------|----------|
| Table with tier badges | Standard data table matching admin patterns | ✓ |
| Card grid | Card per vendor, more visual | |
| Compact list | Minimal list with name + badge + action | |

**User's choice:** Table with tier badges (Recommended)
**Notes:** None

---

## OTP Invite Mechanics

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-send on create | OTP sent when wizard completes | ✓ |
| Manual send after create | Create first, send separately | |
| You decide | Claude picks | |

**User's choice:** Auto-send on create (Recommended)
**Notes:** None

---

## Tier Badge Colors

| Option | Description | Selected |
|--------|-------------|----------|
| Gray / Blue / Gold | Unverified=gray, T1=blue, T2=gold | |
| Gray / Green / Purple | Unverified=gray, T1=green, T2=purple | ✓ |
| You decide | Claude picks | |

**User's choice:** Gray / Green / Purple
**Notes:** None

---

## Admin Sidebar Placement

| Option | Description | Selected |
|--------|-------------|----------|
| After Sales Targets | Position 3 in sidebar | |
| After Vendor Queue | Position 5 | |
| You decide | Claude picks | |

**User's choice:** Other — "Vendor Management" label, placed in existing CDG Admin sidebar
**Notes:** User specified the sidebar item should be called "Vendor Management" and lives within the existing admin sidebar.

---

## Claude's Discretion

- Icon choice for sidebar item
- Wizard dialog vs full-page layout
- Search/autocomplete for vendor profile linking
- Resend cooldown timing
- Table sort/filter capabilities

## Deferred Ideas

None.
