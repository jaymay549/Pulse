---
phase: 1
slug: vendor-auth-primitives
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-13
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (E2E via `@playwright/test`) |
| **Config file** | `playwright.config.ts` |
| **Quick run command** | `npx playwright test --grep "vendor"` |
| **Full suite command** | `npx playwright test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test --grep "vendor"`
- **After every plan wave:** Run `npx playwright test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | AUTH-01 | — | N/A | E2E | `npx playwright test --grep "vendor-login"` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | AUTH-03 | — | Session isolation from Clerk | E2E | `npx playwright test --grep "session-isolation"` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 1 | AUTH-09 | — | shouldCreateUser: false blocks self-registration | E2E | `npx playwright test --grep "self-registration"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `e2e/vendor-auth.spec.ts` — stubs for AUTH-01 through AUTH-09
- [ ] Playwright config already exists — no framework install needed

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| OTP email delivery | AUTH-01 | Requires real Supabase email delivery | Trigger OTP, check inbox, verify 6-digit code |
| Session persistence across browser restart | AUTH-02 | Cannot simulate browser restart in Playwright | Close browser, reopen, verify session |
| Expired OTP error message | AUTH-06 | Requires waiting for OTP expiry | Wait for OTP to expire, attempt entry, verify error |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
