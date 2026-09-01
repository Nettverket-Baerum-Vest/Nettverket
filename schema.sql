-- Nettverkstavla - database-oppsett
-- Kjør hele dette skriptet i Supabase: SQL Editor -> New query -> lim inn -> Run

create extension if not exists "pgcrypto";

-- Avtalte datoer (nettverkstreff, felles samlinger etc.)
create table if not exists network_meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date date not null,
  time text,
  location text,
  note text,
  created_by text,
  moteleder text,
  referent text,
  attending text[],
  not_attending text[],
  created_at timestamptz not null default now()
);

-- Et forslag om å finne en dato (f.eks. "Nettverkstreff høst 2026")
create table if not exists date_proposals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default 'open', -- 'open' eller 'closed'
  created_by text,
  created_at timestamptz not null default now()
);

-- Foreslåtte datoalternativer under et forslag
create table if not exists date_options (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references date_proposals(id) on delete cascade,
  date date not null,
  time text,
  note text,
  created_by text,
  created_at timestamptz not null default now()
);

-- Hvilke barnehager som kan (eller ikke kan) den datoen
create table if not exists date_votes (
  id uuid primary key default gen_random_uuid(),
  option_id uuid not null references date_options(id) on delete cascade,
  barnehage text not null,
  can_attend boolean not null default true,
  name text,
  created_at timestamptz not null default now(),
  unique (option_id, barnehage)
);

-- Slår på row level security
alter table network_meetings enable row level security;
alter table date_proposals enable row level security;
alter table date_options enable row level security;
alter table date_votes enable row level security;

-- Åpen tilgang for alle (ingen innlogging) - lesing og skriving
-- Dette er bevisst enkelt: nettverket er en liten, tillitsbasert gruppe.
drop policy if exists "public full access" on network_meetings;
create policy "public full access" on network_meetings for all using (true) with check (true);

drop policy if exists "public full access" on date_proposals;
create policy "public full access" on date_proposals for all using (true) with check (true);

drop policy if exists "public full access" on date_options;
create policy "public full access" on date_options for all using (true) with check (true);

drop policy if exists "public full access" on date_votes;
create policy "public full access" on date_votes for all using (true) with check (true);
