# Members Table & Mention Attribution Design

## Context

CDG Pulse has no member/user data in Supabase. All user identity lives in Clerk (auth only) and Airtable (rich member profiles). WAM messages have `sender` + `sender_number` on every message but no link to member records. We need to:

1. Import Airtable member data into Supabase
2. Link WAM messages/mentions to specific members
3. Connect Clerk auth to member profiles
4. Enable both admin analytics and personalized member experiences

## Decisions

- **One-time import** from Airtable; Supabase becomes source of truth going forward
- **Clerk linked by email** with `clerk_user_id` stored on member row
- **Mention attribution at ingestion time** via modified WAM sync trigger, with periodic backfill
- **Single `members` table** (no normalization) — member count is small (hundreds)
- **Primary sender attribution** — when a mention spans multiple message senders, pick the first/primary sender

## Schema: `members` Table

```sql
CREATE TABLE public.members (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id          TEXT UNIQUE,

  -- Identity
  name                   TEXT NOT NULL,
  email                  TEXT,
  phone                  TEXT,
  whatsapp_number        TEXT UNIQUE,

  -- Dealership & Role
  dealership_name        TEXT,
  role                   TEXT,
  role_band              TEXT,
  oems                   TEXT[] DEFAULT '{}',
  rooftops               INTEGER,

  -- Location
  city                   TEXT,
  state                  TEXT,
  zip                    TEXT,
  region                 TEXT,

  -- CDG Membership
  tier                   TEXT DEFAULT 'free',
  cohort_id              TEXT,
  status                 TEXT DEFAULT 'active',
  amount_paid            NUMERIC,
  payment_status         TEXT,
  stripe_customer_id     TEXT,

  -- Interests & Context
  biggest_focus          TEXT,
  area_of_interest       TEXT,
  annual_revenue         TEXT,
  volunteer_group_leader BOOLEAN DEFAULT false,
  source_ref             TEXT,
  additional_notes       TEXT,

  -- Timestamps
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Indexes: `whatsapp_number` (unique), `clerk_user_id` (unique), `email`, `state`, `role`.

## Mention Attribution

1. Add `member_id UUID REFERENCES members(id)` to `public.vendor_mentions`
2. Modify `sync_single_wam_processed_mention` trigger to:
   - Take the processed mention's `message_ids`
   - Join to `wam.messages` to get `sender_number` (first/primary sender)
   - Look up `members.whatsapp_number` matching that number
   - Stamp `member_id` on the inserted mention
3. Backfill RPC to retroactively link existing mentions

## Clerk Linking

- On login, call `link_clerk_to_member(clerk_user_id, email)`:
  ```sql
  UPDATE members SET clerk_user_id = p_clerk_user_id
  WHERE email = p_email AND clerk_user_id IS NULL;
  ```
- App loads member data by querying `members WHERE clerk_user_id = auth.jwt() ->> 'sub'`

## RLS Policies

- Members can SELECT their own row (`clerk_user_id = auth.jwt() ->> 'sub'`)
- Admins can SELECT/INSERT/UPDATE/DELETE all rows

## Import Flow

1. Export Airtable to CSV
2. Normalize phone numbers to digits-only with country code (e.g., `12272819611`) to match `wam.messages.sender_number` format
3. Map Airtable columns to `members` schema
4. Insert via Supabase API or `\copy`
5. Run backfill RPC to link existing `vendor_mentions` to members
