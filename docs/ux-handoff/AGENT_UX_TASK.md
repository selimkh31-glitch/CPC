# Consigne — Mise à jour UI/UX ClubPro Connect

## Objectif
Appliquer la référence visuelle et d'interaction décrite dans `docs/ux-handoff/HANDOFF.md`
à l'application Expo / React Native existante, écran par écran.

## Sources
- `docs/ux-handoff/HANDOFF.md` : inventaire des 27 surfaces, composants réutilisables,
  parcours joueur et manager, correspondances web → React Native, exigences mobile.
- `docs/ux-handoff/cpc-tokens.ts` : valeurs exactes (couleurs, typographie, espacements,
  rayons, ombres, opacités, tailles d'icônes/avatars, motion). À recopier à l'identique.

## Règles strictes
- Ne PAS toucher à Supabase, aux policies RLS, au matchmaking, au cycle LIVE,
  aux invitations, candidatures, formations, chat, avis, realtime ni aux règles métier.
- Ne PAS introduire de données fictives dans l'app : les fixtures de la référence
  servent uniquement à comprendre la mise en page.
- Ne PAS ajouter de fonctionnalité, ne pas modifier les flux existants.
- Ne PAS inventer de statistiques EA.
- L'UI visible reste en français (sauf noms propres, pseudos, plateformes et « LIVE »).

## Ordre de travail conseillé
1. Tokens (module partagé + variables NativeWind).
2. Coquille de navigation : BottomNavigation, AppHeader, AppShell.
3. Composants réutilisables : SurfaceCard, Avatar, badges, SectionHeader, Metric,
   InfoRow, ProfileRow, SearchInput, états (chargement / vide / erreur).
4. Écrans dans l'ordre du parcours joueur, puis du parcours manager.

## Validation après chaque écran
- Simulateur iPhone 390 × 844 : aucune coupure, aucun débordement horizontal.
- Zones tactiles ≥ 44 px, safe areas respectées, clavier géré.
- Noms longs tronqués proprement, formation lisible.
