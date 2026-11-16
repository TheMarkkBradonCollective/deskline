-- Deskline schema v1
create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null,
  password_hash text not null,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id text primary key,            -- sha-256 of the session token, never the token itself
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null
);
create index if not exists sessions_user_idx on sessions(user_id);

create table if not exists tickets (
  id bigserial primary key,
  public_id text not null unique,
  subject text not null,
  body text not null,
  category text not null default 'general',
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'waiting', 'resolved', 'closed')),
  requester_id uuid references users(id) on delete set null,
  guest_name text,
  guest_email text,
  guest_token_hash text,
  assignee_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tickets_status_idx on tickets(status, updated_at desc);
create index if not exists tickets_requester_idx on tickets(requester_id);

create table if not exists ticket_events (
  id bigserial primary key,
  ticket_id bigint not null references tickets(id) on delete cascade,
  actor_id uuid references users(id) on delete set null,
  actor_label text not null,
  kind text not null check (kind in ('created', 'status', 'priority', 'assign', 'note', 'reply')),
  body text not null default '',
  internal boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists ticket_events_ticket_idx on ticket_events(ticket_id, created_at);
