---
status: partial
phase: 01-vendor-auth-primitives
source: [01-VERIFICATION.md]
started: 2026-04-13
updated: 2026-04-13
---

## Current Test

[awaiting human testing]

## Tests

### 1. Complete Vendor OTP Login Flow
expected: Enter a provisioned vendor email at /vendor-login, receive 6-digit OTP via email, enter it, land on /vendor-dashboard with vendor-auth key in localStorage
result: [pending]

### 2. Session Persistence Across Reload/Restart
expected: After OTP login, close and reopen browser, navigate to /vendor-dashboard — lands on dashboard without re-authentication
result: [pending]

### 3. Migration Applied to Live Database
expected: Run `supabase db push`, confirm vendor_logins table exists with RLS enabled and "Vendor can read own login" policy
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
