# Compétitions — Ligues / Tournois / Ranking (Phase 2)

> Document de conception, **pas du code enregistré**. Rien ici n'est reflété
> dans `prisma/schema.prisma` ni dans une migration — volontairement, pour ne
> pas créer de dérive de schéma sur une fonctionnalité pas encore construite
> (mission "MISSION AUTONOME 60–90 MIN", section 45 : "ne pas construire un
> faux système... documenter Tournament engine phase 2").
>
> Écrit pendant la session "EA DATA FOUNDATION + SOCIAL + COMPETITIONS +
> PLAYER CARDS + HARDENING" (2026-08-20) — voir le rapport de session pour le
> détail de ce qui a réellement été livré ce jour-là (Chat, Groupes, Player
> Card, EA Adapter).

## 1. Ligues — audit de l'existant (section 16 de la mission)

Le système actuel (`seasons` + `season_stats`, `lib/hooks/useLeagues.ts`,
`supabase/functions/season-ranking`) implémente déjà, de facto, **une ligue
globale unique** : une saison active, des divisions par percentile de points,
des classements buteurs/passeurs/gardiens/MVP. C'est fonctionnel et ne doit
**pas être dupliqué** (mission : "NE PAS créer un deuxième système").

Ce qui manque pour des ligues **multiples** (ex. une ligue par région/niveau,
organisée par un club plutôt que globale) :

```
LEAGUE            (id, name, description, organizer_club_id, status, created_at)
LEAGUE_SEASON     (id, league_id, name, starts_at, ends_at, is_active)
LEAGUE_CLUB       (id, league_season_id, club_id, joined_at)   -- participants
LEAGUE_MATCH      (id, league_season_id, home_club_id, away_club_id, status, scheduled_at)
LEAGUE_STANDING   (id, league_season_id, club_id, points, wins, draws, losses, position)
```

`status` sur `LEAGUE`/`LEAGUE_SEASON` : `DRAFT | OPEN | ACTIVE | COMPLETED | CANCELLED`
(mission section 16). Autorisation : création réservée à un owner/manager de
club (`organizer_club_id`), inscription (`LEAGUE_CLUB`) à valider par
l'organisateur (statut `PENDING`/`ACCEPTED`, même pattern qu'`applications`).

**Recommandation** : ne pas construire tant qu'aucun besoin produit concret
(plusieurs ligues simultanées) n'est confirmé — le système global actuel sert
correctement le MVP.

## 2. Tournament Engine (section 17-18)

Schéma minimal proposé, jamais implémenté :

```
TOURNAMENT              (id, name, format, status, organizer_club_id, starts_at, created_at)
TOURNAMENT_PARTICIPANT  (id, tournament_id, club_id, seed, status, joined_at)
TOURNAMENT_MATCH        (id, tournament_id, round, slot, home_participant_id, away_participant_id,
                          source, context, result_id, scheduled_at, status)
```

- `format` : `KNOCKOUT | LEAGUE | GROUP_STAGE_KNOCKOUT`.
- `status` (tournoi et match) : mêmes valeurs que Ligue.
- `TOURNAMENT_MATCH.result_id` référence `match_results` (Match Result Engine
  existant, `supabase/migrations/0014_match_results.sql`) **si** le match est
  effectivement joué et rapporté dans CPC — jamais une nouvelle table de
  résultat dupliquée (mission section 18 : "un match peut avoir une source
  CPC/EA et un contexte FRIENDLY/LEAGUE/TOURNAMENT/PLAYOFF... ne duplique pas
  la table match sans raison").
- Bracket (KNOCKOUT) : dérivable de `(round, slot)` sur `TOURNAMENT_MATCH`,
  pas besoin d'une table dédiée — génération algorithmique côté Edge
  Function au moment où le tournoi passe `OPEN -> ACTIVE`.

RLS à prévoir (jamais écrites cette session) : lecture publique (authenticated)
du tournoi/bracket une fois `OPEN` ou plus ; écriture réservée à
`organizer_club_id` (owner/manager) via Edge Functions dédiées (création,
inscription, avancement de bracket) — jamais de RPC exposée directement,
la génération de bracket est un calcul serveur, pas une policy simple.

## 3. Ranking — séparer les sources (section 19-20)

Principe déjà respecté par le schéma actuel (`season_stats.points` = calcul
CPC, `users.verified_stats` = cache EA séparé) — à généraliser explicitement
si/quand Ligues et Tournois existent, pour ne jamais mélanger un classement
EA et un classement CPC dans la même ligne :

```
ranking_source        EA | CPC
ranking_type          EA_DIVISION | CPC_GLOBAL | LEAGUE_STANDING | TOURNAMENT_STANDING
```

Concrètement : `season_stats` reste `ranking_type = CPC_GLOBAL` (implicite,
pas de colonne à ajouter tant qu'il n'y a qu'un seul type de classement CPC).
Le jour où `LEAGUE_STANDING`/`TOURNAMENT_STANDING` existent, chaque table de
classement porte déjà son propre nom (pas de table `rankings` fourre-tout à
`ranking_type` — plus simple, plus typé, cohérent avec le reste du schéma
CPC qui préfère des tables nommées à des colonnes discriminantes génériques).
Un futur classement EA (`EA_DIVISION`, si l'API EA officielle expose un jour
un vrai ranking par division) vivrait dans une table séparée
`ea_leaderboard_cache`, alimentée par `EAProvider.getLeaderboard()` (voir
`supabase/functions/_shared/ea/provider.ts`) une fois cette méthode
implémentée — jamais fusionnée avec `season_stats`.

## 4. Pourquoi ce n'a pas été construit cette session

Budget de session limité (60–90 min) et priorités P0/P1 déjà consommées par
l'audit sécurité, la fondation EA, le Chat et les Groupes (voir rapport,
section "Priorités"). Construire un moteur de tournoi ou un système
multi-ligues sans écran ni Edge Function réels aurait produit du schéma mort
non testé — exactement ce que la mission interdit ("ne jamais faire du
fake", section 44). Ce document sert de point de départ pour une session
dédiée à ce chantier.
