-- ============================================================
-- NN Company CRM — Initial Schema
-- ============================================================

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ============================================================
-- Table: telegram_users
-- Registered bot users (auto-registered on /start)
-- ============================================================
create table if not exists telegram_users (
  id          bigint primary key,          -- Telegram user_id
  username    text,
  first_name  text,
  display_name text,                        -- "Босс" / "Тритон"
  registered_at timestamptz default now()
);

-- ============================================================
-- Table: leads
-- ============================================================
create table if not exists leads (
  id           uuid primary key default gen_random_uuid(),
  full_name    text not null,
  phone        text not null,
  contact      text not null,
  offer        text not null,
  payout       numeric(12,2) not null default 0,
  revenue      numeric(12,2) not null default 0,
  referred_by  text,
  comment      text,
  status       text not null default 'В работе',
  added_by     text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ============================================================
-- Table: status_history
-- ============================================================
create table if not exists status_history (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references leads(id) on delete cascade,
  old_status  text not null,
  new_status  text not null,
  changed_by  text not null,
  changed_at  timestamptz not null default now()
);

-- ============================================================
-- Indexes
-- ============================================================
create index if not exists idx_leads_status     on leads(status);
create index if not exists idx_leads_offer      on leads(offer);
create index if not exists idx_leads_created_at on leads(created_at);
create index if not exists idx_status_history_lead_id on status_history(lead_id);

-- ============================================================
-- Trigger: auto-update updated_at on leads
-- ============================================================
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_leads_updated_at on leads;
create trigger trg_leads_updated_at
  before update on leads
  for each row execute function update_updated_at();

-- ============================================================
-- RLS: disabled for simplicity (2-person internal tool)
-- Enable & add policies later if needed
-- ============================================================
alter table leads disable row level security;
alter table status_history disable row level security;
alter table telegram_users disable row level security;
