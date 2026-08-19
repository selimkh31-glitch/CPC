-- ==============================================================================
-- ClubPro Connect — Correctif faille "double réservation de transition"
-- (Phase 5, Étape 5 — audit préalable). PRÉPARÉE, NON APPLIQUÉE : en attente
-- d'accord explicite avant exécution.
--
-- Cause : accept_transition_invitation() (0012_engagement_functions.sql) ne
-- vérifiait jamais si club_departures.transition_invitation_id était déjà
-- posé avant de faire passer une invitation PENDING -> RESERVED. Rien
-- n'empêchait donc un second club (voire une course concurrente entre deux
-- acceptations simultanées) d'écraser silencieusement transition_invitation_id
-- / transition_target_club_id — la règle métier "une seule transition RESERVED
-- à la fois" n'était protégée nulle part côté serveur.
--
-- Portée du correctif : AUCUN changement de schéma (aucune nouvelle colonne,
-- aucun nouvel index/contrainte). Le verrouillage transactionnel déjà présent
-- (`select ... from club_departures ... for update`, ligne existante depuis
-- 0012) suffit à lui seul à fermer la course : deux appels concurrents pour
-- le MÊME departure_request_id se sérialisent sur ce verrou — le second
-- appelant, une fois débloqué, relit la valeur À JOUR de
-- transition_invitation_id (déjà posée par le premier) et peut donc être
-- rejeté avant d'écraser quoi que ce soit. Aucune contrainte DB
-- supplémentaire n'est donc nécessaire (conformément à la consigne : pas de
-- nouvelle architecture si la protection existante suffit).
--
-- CREATE OR REPLACE additif : comportement pré-existant strictement conservé
-- (verrouillage, vérifications not_authorized/invitation_not_pending/
-- not_a_transition_invitation/departure_not_transitionable inchangées) ;
-- seule une garde supplémentaire est ajoutée juste avant le passage à
-- RESERVED.
-- ==============================================================================

create or replace function public.accept_transition_invitation(p_invitation_id uuid, p_actor_id uuid)
returns public.invitations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invitations;
  v_dep public.club_departures;
begin
  select * into v_inv from public.invitations where id = p_invitation_id for update;
  if v_inv is null then
    raise exception 'invitation_not_found';
  end if;
  if v_inv.user_id <> p_actor_id then
    raise exception 'not_authorized';
  end if;
  if v_inv.status <> 'PENDING' then
    raise exception 'invitation_not_pending';
  end if;
  if v_inv.departure_request_id is null then
    raise exception 'not_a_transition_invitation';
  end if;

  -- Verrouille la ligne club_departures partagée par toute offre de
  -- transition concurrente pour ce même départ : c'est ce verrou qui
  -- sérialise deux acceptations simultanées (Club B et Club C), pas une
  -- contrainte DB séparée.
  select * into v_dep from public.club_departures where id = v_inv.departure_request_id for update;
  if v_dep is null or v_dep.status <> 'ACCEPTED_NEXT_MATCH' then
    raise exception 'departure_not_transitionable';
  end if;

  -- Correctif : une transition n'est réservable qu'une seule fois. Si ce
  -- départ a déjà une invitation RESERVED (la sienne ou une autre — une
  -- fois verrouillé ci-dessus, cette valeur est nécessairement à jour même
  -- après avoir attendu un appel concurrent), refuser. transition_invitation_id
  -- / transition_target_club_id ne sont donc jamais réécrits une fois posés.
  if v_dep.transition_invitation_id is not null and v_dep.transition_invitation_id <> v_inv.id then
    raise exception 'player_already_reserved';
  end if;

  update public.invitations set status = 'RESERVED' where id = p_invitation_id returning * into v_inv;

  update public.club_departures
    set transition_invitation_id = v_inv.id, transition_target_club_id = v_inv.club_id
    where id = v_dep.id;

  return v_inv;
end;
$$;

-- CREATE OR REPLACE ne modifie jamais les privilèges existants sur la
-- fonction, mais réaffirmé explicitement par prudence (même précédent que
-- 0009_accept_application_slot.sql après l'incident de restauration).
revoke execute on function public.accept_transition_invitation(uuid, uuid) from public, anon, authenticated;
grant execute on function public.accept_transition_invitation(uuid, uuid) to service_role;
