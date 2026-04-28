---
phase: 8
slug: parent-child-company-filtering-per-product-line-subscription
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-23
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright 1.57.0 (E2E only; no unit test framework configured) |
| **Config file** | `playwright.config.ts` |
| **Quick run command** | `npx playwright test --headed --grep "vendor"` |
| **Full suite command** | `npx playwright test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Manual browser smoke test (vendor login → product switcher → data loads)
- **After every plan wave:** Run `npx playwright test`
- **Before `/gsd-verify-work`:** Full suite must be green + manual D-decision verification
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | D-01 | T-08-01 | vendor_product_subscriptions table exists with FK constraints | manual-only | `psql -c "\d vendor_product_subscriptions"` | N/A | ⬜ pending |
| 08-01-02 | 01 | 1 | D-14 | T-08-02 | vendor_product_tier() returns NULL for unsubscribed product | manual-only | SQL test query | N/A | ⬜ pending |
| 08-02-01 | 02 | 2 | D-04/D-05 | — | N/A | E2E (manual) | `npx playwright test --grep "wizard product"` | ❌ W0 | ⬜ pending |
| 08-02-02 | 02 | 2 | D-07 | — | N/A | E2E (manual) | `npx playwright test --grep "vendor badge"` | ❌ W0 | ⬜ pending |
| 08-03-01 | 03 | 3 | D-08/D-09 | — | N/A | E2E (manual) | `npx playwright test --grep "product switcher"` | ❌ W0 | ⬜ pending |
| 08-03-02 | 03 | 3 | D-11/D-13 | — | N/A | manual-only | Network inspector: RPC calls include product_line_slug | N/A | ⬜ pending |
| 08-03-03 | 03 | 3 | D-12 | T-08-03 | Product-specific tier controls component gating | manual-only | Login as vendor, verify gating matches product tier | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/vendor-product-switcher.spec.ts` — stubs for D-08, D-09, D-13
- [ ] `tests/admin-wizard-product-step.spec.ts` — stubs for D-04, D-05
- [ ] No framework install needed (Playwright already configured)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Table schema correctness | D-01 | DB schema inspection | Run `\d vendor_product_subscriptions` in psql; verify FK constraints and CHECK on tier |
| RLS subscription guard | D-14 | Requires vendor session + curl | Login as vendor, call RPC with unsubscribed product slug, verify empty response |
| RPC slug threading | D-11/D-13 | Network-level inspection | Open browser devtools, switch product lines, verify all RPC calls include correct slug |
| Product-specific tier gating | D-12 | Visual + behavioral | Login as vendor with T1 product, verify gated components; switch to T2 product, verify full access |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
