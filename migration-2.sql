-- Kjør denne i Supabase SQL Editor for å oppdatere en database som allerede
-- kjører schema.sql fra før. (Trengs ikke for helt nye prosjekter, der er
-- alt allerede med i schema.sql.)

-- 1. Stem "kan ikke", ikke bare "kan"
alter table date_votes add column if not exists can_attend boolean not null default true;

-- 2. Møteleder / referent på rundgang, og hvem som deltar på avtalte datoer
alter table network_meetings add column if not exists moteleder text;
alter table network_meetings add column if not exists referent text;
alter table network_meetings add column if not exists attending text[];
alter table network_meetings add column if not exists not_attending text[];
