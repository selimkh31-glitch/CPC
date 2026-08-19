/**
 * Ré-export — la logique canonique du Trust Engine vit désormais dans
 * `supabase/functions/_shared/reliability.ts` (seule source de vérité).
 *
 * Pourquoi le déplacement : 3 Edge Functions (submit-review, link-ea-club,
 * ea-sync) important auparavant `../../../lib/reliability.ts` — un chemin
 * relatif remontant HORS de `supabase/functions/`. Rien ne garantissait que
 * ce chemin survive à tous les mécanismes de bundling/déploiement Supabase
 * (convention officielle = tout ce dont une fonction dépend doit vivre sous
 * `supabase/functions/`, généralement via `_shared/`). En relocalisant le
 * fichier canonique là-bas, les Edge Functions n'importent plus rien en
 * dehors de leur propre arborescence.
 *
 * Ce fichier ne fait que réexporter cette même implémentation pour l'app
 * mobile (Metro n'a aucune restriction de ce type et résout ce chemin sans
 * problème) — aucune logique dupliquée, un seul fichier à modifier.
 */
export * from "../supabase/functions/_shared/reliability";
