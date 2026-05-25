-- ============================================================
-- NN Company CRM — Partner System Schema
-- ============================================================

-- Enable UUID extension (already done in 001, but safe to repeat)
create extension if not exists "pgcrypto";

-- ============================================================
-- Table: partners (whitelist)
-- ============================================================
create table if not exists partners (
  id           uuid primary key default gen_random_uuid(),
  telegram_id  bigint unique,
  username     text unique not null,
  display_name text not null,
  is_active    boolean not null default true,
  notes        text,
  added_by     text,
  created_at   timestamptz not null default now()
);

-- ============================================================
-- Table: partner_offers
-- ============================================================
create table if not exists partner_offers (
  id         uuid primary key default gen_random_uuid(),
  name       text unique not null,
  rate       numeric(12,2) not null default 0,
  is_active  boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Table: partner_rates (individual overrides)
-- ============================================================
create table if not exists partner_rates (
  partner_id uuid not null references partners(id) on delete cascade,
  offer_id   uuid not null references partner_offers(id) on delete cascade,
  rate       numeric(12,2) not null,
  primary key (partner_id, offer_id)
);

-- ============================================================
-- Table: partner_leads
-- ============================================================
create table if not exists partner_leads (
  id                uuid primary key default gen_random_uuid(),
  partner_id        uuid not null references partners(id) on delete cascade,
  full_name         text not null,
  contact           text not null,
  offer             text not null,
  payout_to_partner numeric(12,2) not null default 0,
  approval_status   text not null default 'pending',
  crm_lead_id       uuid references leads(id) on delete set null,
  rejection_reason  text,
  reviewed_by       text,
  reviewed_at       timestamptz,
  created_at        timestamptz not null default now()
);

-- ============================================================
-- Table: partner_payouts
-- ============================================================
create table if not exists partner_payouts (
  id         uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id) on delete cascade,
  amount     numeric(12,2) not null,
  paid_by    text not null,
  notes      text,
  paid_at    timestamptz not null default now()
);

-- ============================================================
-- Disable RLS for all partner tables
-- ============================================================
alter table partners        disable row level security;
alter table partner_offers  disable row level security;
alter table partner_rates   disable row level security;
alter table partner_leads   disable row level security;
alter table partner_payouts disable row level security;

-- ============================================================
-- Indexes
-- ============================================================
create index if not exists idx_partner_leads_partner_id on partner_leads(partner_id);
create index if not exists idx_partner_leads_status     on partner_leads(approval_status);
create index if not exists idx_partner_payouts_partner  on partner_payouts(partner_id);
create index if not exists idx_partners_telegram_id     on partners(telegram_id);
create index if not exists idx_partners_username        on partners(username);

-- ============================================================
-- Seed: initial partner offers
-- ============================================================
insert into partner_offers (name, rate, sort_order) values
  ('Расчётный счёт — Альфа',     1000, 1),
  ('Инвестиции',                  500, 2),
  ('МФО',                        2000, 3),
  ('Дебетовая карта — Альфа',     800, 4),
  ('Дебетовая карта — Тинькофф',  900, 5),
  ('Дебетовая карта — Озон',      700, 6),
  ('Кредитная карта — Сбербанк', 1500, 7),
  ('Кредитная карта — Тинькофф', 1500, 8),
  ('Кредитная карта — Альфа',    1500, 9)
on conflict (name) do nothing;
