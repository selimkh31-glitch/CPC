-- ==============================================================================
-- ClubPro Connect — Match Result Engine, Phase A. À exécuter APRÈS la
-- migration Prisma 20260818020000_match_result_engine (table match_results,
-- enum MatchOutcome, unique composite match_checkins(id, club_id)).
--
-- Portée : RLS + fonction SECURITY DEFINER + grants, dans un seul fichier
-- (contrairement au split 0010/0012 de Phase 5) — le Match Result Engine V1
-- est une seule table + une seule fonction, un split en deux fichiers
-- fragmenterait sans bénéfice une feature de cette taille.
-- ==============================================================================

alter table public.match_results enable row level security;

-- ------------------------------------------------------------------
-- Lecture publique-authentifiée — même philosophie que match_checkins/
-- match_participations/slot_assignments/club_sessions (annuaire transparent,
-- 0002/0010). Aucune policy d'écriture pour authenticated : la création d'un
-- résultat est une séquence de vérifications dynamiques (rôle OWNER/MANAGER,
-- résultat pas déjà créé, MVP réellement PRESENT) qui ne peut être exprimée
-- en RLS seule — réservée à finalize_match (service_role), même raisonnement
-- que launch_match_checkin/accept_application/accept_invitation existants.
-- ------------------------------------------------------------------
create policy "match_results_select_authenticated" on public.match_results
  for select to authenticated using (true);

-- ------------------------------------------------------------------
-- finalize_match — Match Result Engine, Phase A. Owner ou manager du club
-- (jamais restreint à l'auteur du check-in, décision produit validée) valide
-- le résultat d'un match déjà lancé. Verrou `for update` sur match_checkins
-- (même pattern que respond_departure/launch_match_checkin) : empêche deux
-- finalisations concurrentes de passer la vérification "pas déjà créé" en
-- même temps ; l'index unique match_results_match_checkin_id_key reste la
-- garantie DB en dernier recours si jamais ce verrou était contourné.
--
-- outcome n'est JAMAIS un paramètre reçu du client — calculé ici uniquement,
-- à partir de p_our_score/p_opponent_score, en toute fin de fonction.
-- club_id n'est pas non plus un paramètre : dérivé de v_checkin.club_id.
--
-- Exceptions nommées, traduites en messages/status par l'Edge Function
-- appelante : checkin_not_found, not_authorized, invalid_score,
-- already_finalized, mvp_not_present.
-- ------------------------------------------------------------------
create or replace function public.finalize_match(
  p_match_checkin_id uuid,
  p_actor_id uuid,
  p_our_score int,
  p_opponent_score int,
  p_mvp_user_id uuid default null
)
returns public.match_results
language plpgsql
security definer
set search_path = public
as $$
declare
  v_checkin public.match_checkins;
  v_is_manager boolean;
  v_outcome "MatchOutcome";
  v_result public.match_results;
begin
  if p_our_score < 0 or p_opponent_score < 0 then
    raise exception 'invalid_score';
  end if;

  select * into v_checkin from public.match_checkins where id = p_match_checkin_id for update;
  if v_checkin is null then
    raise exception 'checkin_not_found';
  end if;

  select exists(
    select 1 from public.club_members m
    where m.club_id = v_checkin.club_id and m.user_id = p_actor_id and m.role in ('OWNER', 'MANAGER')
  ) into v_is_manager;
  if not v_is_manager then
    raise exception 'not_authorized';
  end if;

  if exists (select 1 from public.match_results where match_checkin_id = p_match_checkin_id) then
    raise exception 'already_finalized';
  end if;

  if p_mvp_user_id is not null and not exists (
    select 1 from public.match_participations
    where match_checkin_id = p_match_checkin_id and user_id = p_mvp_user_id and status = 'PRESENT'
  ) then
    raise exception 'mvp_not_present';
  end if;

  v_outcome := case
    when p_our_score > p_opponent_score then 'WIN'
    when p_our_score < p_opponent_score then 'LOSS'
    else 'DRAW'
  end;

  insert into public.match_results (match_checkin_id, club_id, our_score, opponent_score, outcome, mvp_user_id, recorded_by)
    values (p_match_checkin_id, v_checkin.club_id, p_our_score, p_opponent_score, v_outcome, p_mvp_user_id, p_actor_id)
    returning * into v_result;

  return v_result;
end;
$$;

-- ------------------------------------------------------------------
-- Grants — service_role uniquement, jamais anon/authenticated (appelée
-- exclusivement depuis l'Edge Function finalize-match). Même doctrine que
-- toutes les fonctions Phase 5 (0012_engagement_functions.sql).
-- ------------------------------------------------------------------
revoke execute on function public.finalize_match(uuid, uuid, int, int, uuid) from public, anon, authenticated;
grant execute on function public.finalize_match(uuid, uuid, int, int, uuid) to service_role;
