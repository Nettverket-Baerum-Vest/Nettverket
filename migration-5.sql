-- Kjør denne i Supabase SQL Editor. Hjerteslag-tabellen brukes av
-- GitHub-jobben (.github/workflows/keep-alive.yml) som skriver én rad
-- hver dag, så databasen har jevn aktivitet og ikke settes på pause.

create table if not exists heartbeat (
  id int primary key,
  beat timestamptz not null default now()
);

alter table heartbeat enable row level security;

drop policy if exists "public full access" on heartbeat;
create policy "public full access" on heartbeat for all using (true) with check (true);
