---
status: partial
phase: 07-de-dupe-and-normalize-all-vendor-tenants
source: [07-VERIFICATION.md]
started: 2026-04-16T17:00:00.000Z
updated: 2026-04-16T17:00:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Run migrations on staging and call admin_vendor_health_check()
expected: Returns healthy: true against real vendor data — all counts show zero duplicates, zero unlinked, zero orphans
result: [pending]

### 2. Confirm no alias data loss from bulk merge (CR-01)
expected: After merge migration runs, no alias_text values disappeared entirely from vendor_alias_mappings — all aliases retained on keeper entities
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
