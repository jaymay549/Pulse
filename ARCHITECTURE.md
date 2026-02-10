# CDG Pulse — Architecture Map

## System Overview

```
                    +-------------------------+
                    |    Pulse Frontend        |
                    |    (React + Vite)        |
                    |    cdgpulsecom           |
                    +-----+----------+--------+
                          |          |
            Supabase JS   |          |  Edge Functions
            (direct)      |          |  (vendor-pulse-*)
                          v          v
+----------------------------------------------------------+
|                 Supabase "Pulse"                          |
|                 nsfrxtpxzdmqlezvvjgg                      |
|                                                          |
|  PUBLIC SCHEMA (13 tables)     WAM SCHEMA (20 tables)    |
|  +-----------------------+     +----------------------+  |
|  | profiles              |     | groups               |  |
|  | user_roles            |     | messages             |  |
|  | vendor_reviews        |     | group_summaries      |  |
|  | vendor_profiles       |     | auth_codes           |  |
|  | vendor_responses      |     | pulse_sessions       |  |
|  | vendor_entry_stats    |     | pdf_exports          |  |
|  | vendor_mentions  NEW  |     | default_summary_     |  |
|  | vendor_ignores   NEW  |     |   prompts            |  |
|  | vendor_pulse_    NEW  |     | ai_chat_             |  |
|  |   insights            |     |   conversations      |  |
|  | vendor_groups    NEW  |     | ai_chat_requests     |  |
|  | vendor_aliases   NEW  |     | group_views          |  |
|  | vendor_metadata  NEW  |     | scheduled_tasks      |  |
|  +-----------------------+     | task_definitions     |  |
|                                | task_occurrences     |  |
|  EDGE FUNCTIONS:               | trend_reports        |  |
|  - vendor-ai-chat              | topics               |  |
|  - vendor-pulse-mentions  NEW  | topic_messages       |  |
|  - vendor-pulse-vendors-  NEW  | topic_sentiment_     |  |
|      list                      |   history            |  |
|  - vendor-pulse-vendor-   NEW  | topic_votes          |  |
|      profile                   | job_state            |  |
|  - vendor-pulse-insights  NEW  | vendor_processing_   |  |
|  - vendor-pulse-trending  NEW  |   queue              |  |
|                                +----------^-----------+  |
+-------------------------------------------|------ -------+
                                            |
                              Direct Postgres Connection
                                            |
                    +------ ----------------+----------+
                    |       WAM Backend (Railway)       |
                    |       Thin WhatsApp Layer         |
                    |                                   |
                    |  - whatsapp-web.js + Puppeteer    |
                    |  - Message ingestion -> Supabase  |
                    |  - Message sending <- Supabase    |
                    |  - PDF generation (Chrome)        |
                    |  - Cron jobs (WhatsApp-dependent) |
                    |  - Gemini AI processing           |
                    |  - ZERO local data storage        |
                    +----------------------------------+
```

## Data Flow

### Message Ingestion
```
WhatsApp Group Message
        |
        v
  whatsapp-web.js (Railway)
        |
        v
  INSERT INTO wam.messages  ──>  Supabase Postgres
        |
        v
  Cron: Topic Processing    ──>  wam.topics, wam.topic_messages
        |
        v
  Cron: Vendor Processing   ──>  wam.vendor_processing_queue
        |                         |
        v                         v (admin approves)
  AI Extraction (Gemini)    public.vendor_mentions
```

### Vendor Intelligence Pipeline
```
  wam.messages
       |
       v (batch by day, 2+ messages/chunk)
  wam.vendor_processing_queue  [status: pending]
       |
       v (Gemini AI extraction)
  wam.vendor_processing_queue  [status: processed]
       |
       v (admin approves individual mentions)
  public.vendor_mentions
       |
       v (served to frontend)
  Edge Function: vendor-pulse-mentions
       |
       v (tier-based redaction: free=redacted, pro=full)
  Pulse Frontend
```

### Task Scheduling
```
  wam.task_definitions  (reusable templates)
       |
       v (cron generates at scheduled time)
  wam.task_occurrences  [status: pending -> generating -> ready]
       |
       v (AI summary via Gemini)
  wam.pdf_exports  (generated PDF)
       |
       v (cron sends at scheduled time)
  WhatsApp Groups  (via whatsapp-web.js on Railway)
  wam.task_occurrences  [status: sent]
```

## Schema Details

### Public Schema (existing + new)

#### Existing Tables (unchanged)
| Table | Purpose | RLS |
|-------|---------|-----|
| `profiles` | User accounts (FK auth.users) | Own-user read/write |
| `user_roles` | Tier management (free/pro/executive/admin) | Own-user read |
| `vendor_reviews` | Published review cards | Public read, service-role write |
| `vendor_profiles` | Verified vendor accounts | Own-user + approved public |
| `vendor_responses` | Vendor replies to reviews | Public read, verified-vendor write |
| `vendor_entry_stats` | View/share counts | Public read, function-based write |

#### New Tables
| Table | Purpose | RLS |
|-------|---------|-----|
| `vendor_mentions` | AI-extracted vendor facts (approved) | Public read, service-role write |
| `vendor_ignores` | Patterns to skip in AI extraction | Service-role only |
| `vendor_pulse_insights` | Cached AI insight summaries (TTL) | Public read (non-expired) |
| `vendor_groups` | Canonical vendor name groupings | Public read, service-role write |
| `vendor_aliases` | Alternate vendor name spellings | Public read, service-role write |
| `vendor_metadata` | Vendor info (website, logo, desc) | Public read, service-role write |

### WAM Schema (all new, service-role only)

| Table | Purpose | Est. Rows |
|-------|---------|-----------|
| `groups` | WhatsApp group metadata | ~100s |
| `messages` | All WhatsApp messages | ~100K+ |
| `group_summaries` | Latest AI summary per group | ~100s |
| `auth_codes` | OTP codes (ephemeral) | ~10s |
| `pulse_sessions` | User sessions (ephemeral) | ~10s |
| `pdf_exports` | Generated PDF report metadata | ~100s |
| `default_summary_prompts` | AI prompt templates with versioning | ~10s |
| `ai_chat_conversations` | Saved AI chat sessions | ~100s |
| `ai_chat_requests` | Async AI request queue | ~100s |
| `group_views` | Custom group filter configurations | ~10s |
| `scheduled_tasks` | One-off scheduled tasks (legacy) | ~100s |
| `task_definitions` | Reusable task templates | ~10s |
| `task_occurrences` | Task execution records | ~100s |
| `trend_reports` | Daily/weekly trend analysis | ~100s |
| `topics` | Discussion topics with trending scores | ~1000s |
| `topic_messages` | Topic-to-message mapping | ~10K+ |
| `topic_sentiment_history` | Sentiment tracking over time | ~1000s |
| `topic_votes` | User upvotes/downvotes on topics | ~100s |
| `job_state` | Background job progress tracking | ~10s |
| `vendor_processing_queue` | AI extraction work queue | ~1000s |

## Enums

| Enum | Values |
|------|--------|
| `app_role` (existing) | free, pro, executive, viewer, verified_vendor, admin |
| `review_type` (existing) | positive, warning |
| `mention_sentiment` | positive, negative, neutral, mixed |
| `mention_dimension` | worth_it, reliable, integrates, support, adopted, other |
| `task_status` | pending, generating, ready, sending, sent, failed, rejected, cancelled |
| `topic_status` | active, archived, merged |
| `vote_type` | upvote, downvote |
| `queue_status` | pending, processing, processed, failed |

## Authentication

- **Pulse Frontend**: Clerk -> Supabase Auth (JWT)
- **WAM Backend**: Direct Postgres connection with service_role credentials
- **Edge Functions**: Supabase Auth JWT verification + tier check via `user_roles`

## External Integrations

| Service | Used By | Purpose |
|---------|---------|---------|
| WhatsApp (whatsapp-web.js) | WAM Backend | Message send/receive |
| Google Gemini | WAM Backend | AI summarization, vendor extraction, trends |
| Clerk | Frontend + WAM | User authentication |
| Airtable | WAM Backend | Legacy user management (being phased out) |
| Stripe | Frontend | Subscription billing |
