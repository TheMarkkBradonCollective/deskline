-- Tracks when the public demo data was last reset (replaces a cron trigger).
create table if not exists demo_meta (
  key text primary key,
  at timestamptz not null default now()
);
