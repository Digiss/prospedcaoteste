/*
# Recriar schema do CRM alinhado com a especificação

## Visão geral
Substitui a tabela inicial `channels` por um schema normalizado que segue a especificação
do CRM, com tabelas filhas para candidatos de email, candidatos de telegram e descrições
de vídeos.

## 1. Remover tabela existente
- Drop `channels` (0 linhas — sendo substituída pelo schema alinhado à especificação)

## 2. Tipos enum
- `link_type`: canal | video | busca
- `origin_type`: auto | manual | nao_encontrado | conflito
- `contact_status`: nao_contatado | contatado | respondeu | fechado | recusado
- `group_color`: vermelho | laranja | amarelo | verde | azul | roxo | rosa | cinza
- `data_source`: sobre | video | manual

## 3. Novas tabelas

### channels — tabela principal de prospecção
- id (text, PK) — id estável gerado pelo cliente
- canal_nome (text, nullable) — nome do canal
- link_original (text, not null) — primeira URL que originou a linha
- links_relacionados (jsonb, default []) — outras URLs fundidas via reimport
- tipo_link (enum link_type) — canal | video | busca
- channel_id (text, nullable) — ID do canal YouTube, preenchido após resolução
- handle (text, default '') — handle do YouTube (ex: @name)
- email (text, nullable) — email de contato
- email_origem (enum origin_type) — origem do email
- telegram_grupo (text, nullable) — handle/grupo do Telegram
- telegram_origem (enum origin_type) — origem do telegram
- fonte_dado (enum data_source, nullable) — fonte dos dados
- status (enum contact_status) — status no pipeline
- data_contato (date, nullable) — data de contato
- observacoes (text, nullable) — observações livres
- cor_agrupamento (enum group_color, nullable) — cor de agrupamento visual
- raw (boolean, default true) — linha ainda não processada
- origin (enum origin_type) — origem da linha
- criado_em (timestamptz) — data de criação
- atualizado_em (timestamptz) — data de modificação

### email_candidates — candidatos de email por canal
- id (uuid, PK)
- channel_id (text, FK → channels.id ON DELETE CASCADE)
- value (text) — o endereço de email
- source (enum data_source, nullable) — onde foi encontrado
- video_id (text, nullable) — vídeo onde foi encontrado
- criado_em (timestamptz)

### telegram_candidates — candidatos de telegram por canal
- id (uuid, PK)
- channel_id (text, FK → channels.id ON DELETE CASCADE)
- value (text) — o handle do telegram
- source (enum data_source, nullable)
- video_id (text, nullable)
- criado_em (timestamptz)

### video_descriptions — descrições de vídeos por canal
- id (uuid, PK)
- channel_id (text, FK → channels.id ON DELETE CASCADE)
- video_id (text) — ID do vídeo YouTube
- description (text) — descrição bruta do vídeo
- criado_em (timestamptz)

## 4. Segurança
- RLS habilitado em todas as tabelas
- App single-tenant sem auth: anon + authenticated CRUD completo em todas as tabelas

## 5. Índices
- channels: status, tipo_link, link_original, channel_id
- Todas as tabelas filhas: channel_id
*/

-- Drop existing table (0 rows, being replaced)
DROP TABLE IF EXISTS channels CASCADE;

-- Enum types
DO $$ BEGIN
  CREATE TYPE link_type AS ENUM ('canal', 'video', 'busca');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE origin_type AS ENUM ('auto', 'manual', 'nao_encontrado', 'conflito');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE contact_status AS ENUM ('nao_contatado', 'contatado', 'respondeu', 'fechado', 'recusado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE group_color AS ENUM ('vermelho', 'laranja', 'amarelo', 'verde', 'azul', 'roxo', 'rosa', 'cinza');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE data_source AS ENUM ('sobre', 'video', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Main channels table
CREATE TABLE IF NOT EXISTS channels (
  id text PRIMARY KEY,
  canal_nome text,
  link_original text NOT NULL,
  links_relacionados jsonb NOT NULL DEFAULT '[]'::jsonb,
  tipo_link link_type NOT NULL DEFAULT 'video',
  channel_id text,
  handle text NOT NULL DEFAULT '',
  email text,
  email_origem origin_type NOT NULL DEFAULT 'nao_encontrado',
  telegram_grupo text,
  telegram_origem origin_type NOT NULL DEFAULT 'nao_encontrado',
  fonte_dado data_source,
  status contact_status NOT NULL DEFAULT 'nao_contatado',
  data_contato date,
  observacoes text,
  cor_agrupamento group_color,
  raw boolean NOT NULL DEFAULT true,
  origin origin_type NOT NULL DEFAULT 'auto',
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- Child tables
CREATE TABLE IF NOT EXISTS email_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id text NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  value text NOT NULL,
  source data_source,
  video_id text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS telegram_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id text NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  value text NOT NULL,
  source data_source,
  video_id text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS video_descriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id text NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  video_id text NOT NULL,
  description text NOT NULL DEFAULT '',
  criado_em timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_descriptions ENABLE ROW LEVEL SECURITY;

-- Channels policies
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

-- Email candidates policies
DROP POLICY IF EXISTS "anon_select_email_candidates" ON email_candidates;
CREATE POLICY "anon_select_email_candidates" ON email_candidates FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_email_candidates" ON email_candidates;
CREATE POLICY "anon_insert_email_candidates" ON email_candidates FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_email_candidates" ON email_candidates;
CREATE POLICY "anon_update_email_candidates" ON email_candidates FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_email_candidates" ON email_candidates;
CREATE POLICY "anon_delete_email_candidates" ON email_candidates FOR DELETE
  TO anon, authenticated USING (true);

-- Telegram candidates policies
DROP POLICY IF EXISTS "anon_select_telegram_candidates" ON telegram_candidates;
CREATE POLICY "anon_select_telegram_candidates" ON telegram_candidates FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_telegram_candidates" ON telegram_candidates;
CREATE POLICY "anon_insert_telegram_candidates" ON telegram_candidates FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_telegram_candidates" ON telegram_candidates;
CREATE POLICY "anon_update_telegram_candidates" ON telegram_candidates FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_telegram_candidates" ON telegram_candidates;
CREATE POLICY "anon_delete_telegram_candidates" ON telegram_candidates FOR DELETE
  TO anon, authenticated USING (true);

-- Video descriptions policies
DROP POLICY IF EXISTS "anon_select_video_descriptions" ON video_descriptions;
CREATE POLICY "anon_select_video_descriptions" ON video_descriptions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_video_descriptions" ON video_descriptions;
CREATE POLICY "anon_insert_video_descriptions" ON video_descriptions FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_video_descriptions" ON video_descriptions;
CREATE POLICY "anon_update_video_descriptions" ON video_descriptions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_video_descriptions" ON video_descriptions;
CREATE POLICY "anon_delete_video_descriptions" ON video_descriptions FOR DELETE
  TO anon, authenticated USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_channels_status ON channels (status);
CREATE INDEX IF NOT EXISTS idx_channels_tipo_link ON channels (tipo_link);
CREATE INDEX IF NOT EXISTS idx_channels_link_original ON channels (link_original);
CREATE INDEX IF NOT EXISTS idx_channels_channel_id ON channels (channel_id);
CREATE INDEX IF NOT EXISTS idx_email_candidates_channel_id ON email_candidates (channel_id);
CREATE INDEX IF NOT EXISTS idx_telegram_candidates_channel_id ON telegram_candidates (channel_id);
CREATE INDEX IF NOT EXISTS idx_video_descriptions_channel_id ON video_descriptions (channel_id);

-- Auto-update atualizado_em on row update
CREATE OR REPLACE FUNCTION update_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_channels_atualizado_em ON channels;
CREATE TRIGGER trigger_channels_atualizado_em
  BEFORE UPDATE ON channels
  FOR EACH ROW
  EXECUTE FUNCTION update_atualizado_em();
