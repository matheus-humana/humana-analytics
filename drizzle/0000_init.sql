CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE analytics_provider AS ENUM (
    'google_analytics',
    'microsoft_clarity',
    'vercel_analytics'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE data_source_status AS ENUM (
    'pending',
    'connected',
    'error'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS projects_organization_name_idx
  ON projects (organization_id, name);

CREATE TABLE IF NOT EXISTS data_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  provider analytics_provider NOT NULL,
  name text NOT NULL,
  external_id text NOT NULL,
  status data_source_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS data_sources_project_provider_external_idx
  ON data_sources (project_id, provider, external_id);

CREATE TABLE IF NOT EXISTS data_source_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id uuid NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  auth_type text NOT NULL,
  config_ref text NOT NULL,
  principal text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS data_source_credentials_source_idx
  ON data_source_credentials (data_source_id);

CREATE TABLE IF NOT EXISTS analytics_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id uuid NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  date date NOT NULL,
  active_users integer NOT NULL DEFAULT 0,
  sessions integer NOT NULL DEFAULT 0,
  screen_page_views integer NOT NULL DEFAULT 0,
  engagement_rate double precision NOT NULL DEFAULT 0,
  new_users integer NOT NULL DEFAULT 0,
  event_count integer NOT NULL DEFAULT 0,
  key_events integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (data_source_id, date)
);

CREATE TABLE IF NOT EXISTS analytics_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id uuid NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  date date NOT NULL,
  page_path text NOT NULL,
  page_title text NOT NULL DEFAULT '',
  screen_page_views integer NOT NULL DEFAULT 0,
  active_users integer NOT NULL DEFAULT 0,
  engagement_rate double precision NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (data_source_id, date, page_path)
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id uuid NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  date date NOT NULL,
  event_name text NOT NULL,
  event_count integer NOT NULL DEFAULT 0,
  active_users integer NOT NULL DEFAULT 0,
  key_events integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (data_source_id, date, event_name)
);

CREATE TABLE IF NOT EXISTS analytics_traffic_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id uuid NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  date date NOT NULL,
  source text NOT NULL,
  medium text NOT NULL,
  active_users integer NOT NULL DEFAULT 0,
  sessions integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (data_source_id, date, source, medium)
);

CREATE TABLE IF NOT EXISTS analytics_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id uuid NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  status text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  rows_upserted jsonb,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS analytics_daily_source_date_idx
  ON analytics_daily (data_source_id, date DESC);

CREATE INDEX IF NOT EXISTS analytics_pages_source_date_idx
  ON analytics_pages (data_source_id, date DESC);

CREATE INDEX IF NOT EXISTS analytics_events_source_date_idx
  ON analytics_events (data_source_id, date DESC);

CREATE INDEX IF NOT EXISTS analytics_traffic_sources_source_date_idx
  ON analytics_traffic_sources (data_source_id, date DESC);

CREATE INDEX IF NOT EXISTS analytics_sync_runs_source_started_idx
  ON analytics_sync_runs (data_source_id, started_at DESC);
