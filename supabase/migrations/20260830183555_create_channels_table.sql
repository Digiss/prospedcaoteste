/*
# Create channels table for YouTube CRM

1. New Tables
- `channels` — stores prospected YouTube channels and their contact/status data.
  - `id` (text, primary key) — client-generated stable id.
  - `name` (text) — channel display name.
  - `handle` (text) — YouTube handle (e.g. @name).
  - `url` (text) — original link that originated the row.
  - `kind` (enum: canal | video | busca) — link type.
  - `email` (text, nullable) — contact email.
  - `telegram` (text, nullable) — Telegram handle/group.
  - `email_origem` (enum: auto | manual | nao_encontrado | conflito) — email origin.
  - `telegram_origem` (enum: auto | manual | nao_encontrado | conflito) — telegram origin.
  - `fonte_dado` (enum: sobre | video | manual, nullable) — data source.
  - `email_candidates` (jsonb) — list of email candidates found during enrichment.
  - `telegram_candidates` (jsonb) — list of telegram candidates.
  - `video_descriptions` (jsonb) — list of video descriptions collected.
  - `status` (enum: novo | qualificado | contato | contatado | descartado) — pipeline status.
  - `notes` (text) — free-form observations.
  - `color` (enum: amber | blue | green | purple | red | cyan | pink | slate) — grouping color.
  - `raw` (boolean) — whether the row is still unprocessed/raw.
  - `origin` (enum: auto | manual | nao_encontrado | conflito) — row origin.
  - `date` (text) — contact date string (pt-BR format).
  - `related` (jsonb) — list of related links merged into this row.
  - `created_at` (timestamptz) — row creation time.
  - `updated_at` (timestamptz) — last modification time.

2. Security
- Enable RLS on `channels`.
- Single-tenant app with no sign-in: allow anon + authenticated full CRUD (data is intentionally shared).
*/

CREATE TABLE IF NOT EXISTS channels (
  id text PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  handle text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'video',
  email text DEFAULT '',
  telegram text DEFAULT '',
  email_origem text NOT NULL DEFAULT 'nao_encontrado',
  telegram_origem text NOT NULL DEFAULT 'nao_encontrado',
  fonte_dado text DEFAULT NULL,
  email_candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
  telegram_candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
  video_descriptions jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'novo',
  notes text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT 'slate',
  raw boolean NOT NULL DEFAULT true,
  origin text NOT NULL DEFAULT 'auto',
  date text NOT NULL DEFAULT '',
  related jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_channels" ON channels;
CREATE POLICY "anon_select_channels" ON channels FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_channels" ON channels;
CREATE POLICY "anon_insert_channels" ON channels FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_channels" ON channels;
CREATE POLICY "anon_update_channels" ON channels FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_channels" ON channels;
CREATE POLICY "anon_delete_channels" ON channels FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_channels_status ON channels (status);
CREATE INDEX IF NOT EXISTS idx_channels_kind ON channels (kind);
CREATE INDEX IF NOT EXISTS idx_channels_url ON channels (url);
