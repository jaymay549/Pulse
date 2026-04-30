-- ============================================================
-- WAM health monitor tables
-- Populated by the cdg-wam Railway service. Read by the Pulse
-- admin System Health page. Both tables are append-only; older
-- rows can be pruned via a separate retention job (not in scope).
-- ============================================================

-- Heartbeat: one row every ~60s while a WhatsApp client is alive.
-- Absence of recent rows is itself the signal that ingestion is dead.
CREATE TABLE IF NOT EXISTS wam.ingest_heartbeat (
  id BIGSERIAL PRIMARY KEY,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  client_name TEXT NOT NULL,         -- 'whatsapp-web.js' | 'baileys'
  client_state TEXT NOT NULL,        -- e.g. CONNECTED | OPENING | READY | IDLE
  groups_total INTEGER,              -- groups visible to the WhatsApp client
  groups_monitored INTEGER,          -- monitored groups in our DB
  phone_number TEXT,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_ingest_heartbeat_recorded_at
  ON wam.ingest_heartbeat (recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_ingest_heartbeat_client_recorded
  ON wam.ingest_heartbeat (client_name, recorded_at DESC);

-- Lifecycle events: every state transition / disconnect / auth_failure / qr.
-- Append-only timeline of "what happened" so outages have a paper trail.
CREATE TABLE IF NOT EXISTS wam.client_lifecycle_events (
  id BIGSERIAL PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  client_name TEXT NOT NULL,
  event_type TEXT NOT NULL,          -- state_change | disconnected | auth_failure | qr | ready | logged_out
  from_state TEXT,
  to_state TEXT,
  reason TEXT,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_client_lifecycle_events_occurred_at
  ON wam.client_lifecycle_events (occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_lifecycle_events_type_time
  ON wam.client_lifecycle_events (event_type, occurred_at DESC);

-- Service-role only; mirrors the rest of the wam.* tables.
GRANT USAGE ON SCHEMA wam TO service_role;
GRANT SELECT, INSERT ON wam.ingest_heartbeat TO service_role;
GRANT SELECT, INSERT ON wam.client_lifecycle_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE wam.ingest_heartbeat_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE wam.client_lifecycle_events_id_seq TO service_role;
