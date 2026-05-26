-- Add tg_msg_ids column to partner_leads
-- Stores [{chat_id, message_id}] for each admin Telegram notification
-- so partner-approve.js can clear buttons when a lead is approved/rejected from any source
ALTER TABLE partner_leads
  ADD COLUMN IF NOT EXISTS tg_msg_ids JSONB DEFAULT '[]'::jsonb;
