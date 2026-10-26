-- Kjør denne i Supabase SQL Editor: sted på forslag, så det følger med
-- over til det avtalte møtet når en dato låses.

alter table date_proposals add column if not exists location text;
