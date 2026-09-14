-- Kjør denne i Supabase SQL Editor for å legge til den frie beskjedtavla
-- (påminnelser, frister, hvor ting befinner seg).

create table if not exists notices (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  location text,
  created_by text,
  created_at timestamptz not null default now()
);

alter table notices enable row level security;

drop policy if exists "public full access" on notices;
create policy "public full access" on notices for all using (true) with check (true);
