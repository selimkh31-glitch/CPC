-- ==============================================================================
-- ClubPro Connect — triggers Postgres
-- À exécuter APRÈS 0002_rls_policies.sql.
-- ==============================================================================

-- ------------------------------------------------------------------
-- Atomicité "créer un club" (section 3.B) : le client (useCreateClub, voir
-- lib/hooks/useClubs.ts) ne fait qu'un INSERT dans `clubs`. Ce trigger crée le
-- club_members OWNER dans la MÊME transaction — plus de risque de club
-- orphelin si le 2e INSERT client échouait auparavant (perte réseau, etc.).
-- SECURITY DEFINER : l'INSERT dans club_members bypass RLS (comme le ferait
-- un service_role), donc pas besoin d'ouvrir club_members à l'INSERT client.
-- ------------------------------------------------------------------
create or replace function public.handle_new_club()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.club_members (club_id, user_id, role)
  values (new.id, new.owner_id, 'OWNER');
  return new;
end;
$$;

drop trigger if exists on_club_created on public.clubs;
create trigger on_club_created
  after insert on public.clubs
  for each row execute function public.handle_new_club();

-- ------------------------------------------------------------------
-- `club_sessions.updated_at` (section 3.C, tri du Live Feed) : le toggle
-- LIVE ON/OFF (useToggleSession) fait un simple UPDATE is_live sans jamais
-- toucher updated_at côté client. `moddatetime` (extension standard livrée
-- avec Postgres/Supabase) le rafraîchit automatiquement à chaque UPDATE.
-- ------------------------------------------------------------------
create extension if not exists moddatetime schema extensions;

drop trigger if exists handle_updated_at on public.club_sessions;
create trigger handle_updated_at
  before update on public.club_sessions
  for each row execute function extensions.moddatetime(updated_at);
