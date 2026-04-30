-- ============================================================
-- Validation table for Baileys A/B testing
--
-- During the Baileys validation window the cdg-wam service writes
-- ingested messages from the Baileys client into this table while
-- the whatsapp-web.js client continues writing to wam.messages via
-- the existing SQLite + DualWrite pipeline.
--
-- This guarantees a clean A/B comparison without depending on the
-- two libraries producing identical whatsapp_message_id strings
-- (they can differ when the participant field renders as @lid vs
-- @s.whatsapp.net depending on sender privacy settings).
--
-- After validation: compare per-group coverage between
-- wam.messages and wam.messages_baileys, decide cutover, then
-- drop this table.
-- ============================================================

CREATE TABLE IF NOT EXISTS wam.messages_baileys (
  id BIGSERIAL PRIMARY KEY,
  group_id BIGINT,                          -- references wam.groups.id (cdg-wam SQLite id)
  whatsapp_group_jid TEXT NOT NULL,         -- the @g.us JID for direct comparison with wam.groups.whatsapp_id
  sender TEXT,
  sender_number TEXT,
  content TEXT,
  timestamp TIMESTAMPTZ,                    -- WhatsApp-side message timestamp
  whatsapp_message_id TEXT NOT NULL UNIQUE, -- {fromMe}_{remoteJid}_{key.id}_{participant}
  message_type TEXT,                        -- top-level key from msg.message (conversation | imageMessage | …)
  raw_message_keys JSONB,                   -- {id, fromMe, participant, remoteJid} for debugging participant format
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_baileys_received_at
  ON wam.messages_baileys (received_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_baileys_group_jid
  ON wam.messages_baileys (whatsapp_group_jid);

CREATE INDEX IF NOT EXISTS idx_messages_baileys_timestamp
  ON wam.messages_baileys (timestamp DESC);

GRANT SELECT, INSERT ON wam.messages_baileys TO service_role;
GRANT USAGE, SELECT ON SEQUENCE wam.messages_baileys_id_seq TO service_role;
