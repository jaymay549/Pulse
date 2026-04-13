---
status: partial
phase: 03-tier-gated-data-access
source: [03-VERIFICATION.md]
started: 2026-04-13
updated: 2026-04-13
---

## Current Test

[awaiting human testing]

## Tests

### 1. T1 vendor sidebar visibility
expected: Exactly 7 sections visible in sidebar, 4 T2 sections hidden
result: [pending]

### 2. T2 vendor data + vendor isolation
expected: All 11 sections visible, only own-vendor data loads
result: [pending]

### 3. DB-level cross-vendor block
expected: Spoofed RPC call with wrong vendor name returns empty response
result: [pending]

### 4. Dealer feed regression
expected: /vendors public feed still loads after vendor_mentions RLS
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
