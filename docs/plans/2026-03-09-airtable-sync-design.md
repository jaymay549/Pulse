# Airtable → Supabase Member Sync

**Date:** 2026-03-09
**Status:** Approved

## Problem

Members are currently managed in Airtable (CDG Circles base). The existing import is a one-time CSV script. We need an on-demand sync that admins can trigger from the UI, pulling members directly from Airtable's API into Supabase.

## Requirements

- On-demand sync triggered by admin button on `/admin/members`
- Airtable is source of truth during transition period
- New members inserted, existing members updated
- Supabase-only fields preserved on update (`clerk_user_id`, `id`, `created_at`, `updated_at`)
- Only overwrite Airtable-sourced fields when Airtable value is non-null
- Clerk login matching (already built) continues working — `link_clerk_to_member` RPC matches by email

## Airtable Source

- **Base:** CDG Circles (`appj7CZzZs3hMkWE2`)
- **Table:** Members (`tblQ9nzGzgc8iOHbc`)
- **Key fields:** email, name, phone, dealership_name, city_state, state, zip, role, role_band, OEMs, biggest_focus, area_of_interest, rooftops, region, tier, amount_paid, payment_status, status, whatsapp_number, volunteer_group_leader, additional_notes, stripe_customer_id, cohort_id, source_ref, annual_revenue, clean_phone

## Architecture

### 1. Supabase Edge Function: `sync-airtable-members`

- Fetches all records from Airtable Members table via REST API (paginated)
- Maps Airtable fields → Supabase `members` schema
- Reuses normalization logic from `scripts/import-airtable-members.ts`:
  - Phone normalization (digits only, prepend "1" for 10-digit US)
  - OEM parsing (comma/semicolon split)
  - City extraction from `city_state`
  - `volunteer_group_leader` string → boolean
  - `singleSelect` objects → plain string values
- Upserts via SQL function `upsert_member_from_airtable` that:
  - Matches on `email` (primary), `whatsapp_number` (fallback)
  - Inserts new members
  - Updates existing members, preserving Supabase-only fields
  - Uses `COALESCE(new_value, existing_value)` pattern to skip null Airtable values
- Returns `{ inserted, updated, skipped, errors }`
- **Secret:** `AIRTABLE_API_KEY`

### 2. SQL Migration: `upsert_member_from_airtable` RPC

PostgreSQL function that handles the upsert logic with field preservation.

### 3. Admin UI: Sync Button

- "Sync from Airtable" button in MembersPage header
- Calls edge function via authenticated fetch
- Loading state during sync
- Toast notification with sync results

### 4. Clerk Matching (No Changes)

Existing flow preserved:
1. Clerk login → `useMemberProfile` → `link_clerk_to_member` RPC
2. Matches by email (case-insensitive)
3. Stamps `clerk_user_id` on member row
4. Sync preserves `clerk_user_id` via COALESCE pattern

## Non-Goals

- Bidirectional sync (Supabase → Airtable)
- Scheduled/automatic sync
- Cohort record linking (stored as text ID for now)
