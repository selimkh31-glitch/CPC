-- ==============================================================================
-- ClubPro Connect — Défense en profondeur invitations (hotfix M3-2).
--
-- Contexte : la garde applicative M3 (invite-to-slot, section "M3" du fichier)
-- empêche déjà un joueur d'avoir plus d'une invitation PENDING par club, quel
-- que soit le slot visé. Mais rien côté DB ne garantissait cet invariant —
-- l'audit "INVITATIONS PENDING — AUDIT GLOBAL DES DOUBLONS" a montré qu'une
-- régression applicative (ici : .maybeSingle() silencieusement inopérant dès
-- que ≥2 lignes PENDING existaient déjà pour la paire) pouvait laisser
-- s'accumuler des doublons sans qu'aucune contrainte ne les bloque.
--
-- Cet index unique partiel est la garantie de dernier recours : même en cas
-- de nouvelle régression applicative ou de course concurrente (deux requêtes
-- simultanées passant chacune la vérification app avant qu'aucune n'ait
-- encore inséré), PostgreSQL refusera la seconde ligne PENDING. Symétrique de
-- invitations_one_pending_transition_per_departure (0010_engagement_model.sql),
-- même pattern d'index unique partiel, déjà géré côté Edge Function (voir le
-- bloc `if (error) { ... }` après l'insert dans invite-to-slot/index.ts).
--
-- Scope volontairement limité à status = 'PENDING' :
--   - n'empêche jamais plusieurs lignes CANCELLED/ACCEPTED/DECLINED/RESERVED
--     historiques pour le même (club_id, user_id) — l'historique reste intact ;
--   - n'empêche jamais plusieurs invitations PENDING du même joueur dans des
--     clubs différents (club_id fait partie de la clé de l'index).
-- ==============================================================================

create unique index invitations_one_pending_per_club_user
  on public.invitations (club_id, user_id)
  where status = 'PENDING';
