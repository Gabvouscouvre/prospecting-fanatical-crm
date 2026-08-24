-- À exécuter dans Supabase : Dashboard > SQL Editor > New query > coller > Run

create extension if not exists "uuid-ossp";

create table if not exists dealers (
  id uuid primary key default uuid_generate_v4(),
  concession text not null,
  contact text default '',
  telephone text default '',
  email text default '',
  responsable text default '',        -- 'G' | 'P' | 'J' | ''
  statut_appel text default '',       -- 'R' | 'PR' | ''
  engagement text default '',         -- 'V' | 'J' | 'R' | 'D' | 'B' | ''
  date_dernier_contact date,
  date_prochain_suivi date,
  note text default '',
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Row Level Security : seuls les comptes connectés (vous 3) peuvent lire/écrire,
-- personne d'autre au monde n'y a accès.
alter table dealers enable row level security;

create policy "authenticated_select" on dealers
  for select using (auth.role() = 'authenticated');

create policy "authenticated_insert" on dealers
  for insert with check (auth.role() = 'authenticated');

create policy "authenticated_update" on dealers
  for update using (auth.role() = 'authenticated');

create policy "authenticated_delete" on dealers
  for delete using (auth.role() = 'authenticated');

-- Garde updated_at à jour automatiquement
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger dealers_updated_at
  before update on dealers
  for each row execute function set_updated_at();
