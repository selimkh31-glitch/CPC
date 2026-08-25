# EA FC Pro Clubs — Matrice de capacité

> Audit factuel de ce qui existe dans le repo pour la donnée EA FC Pro Clubs
> (unofficial `proclubs.ea.com/api/fc`). Import stocké comme non vérifié.

## Légende des colonnes

- **Source** : fichier qui possède la logique réseau réelle.
- **Testé réellement ?** : exécuté contre `proclubs.ea.com` pendant une
  session de développement, avec une vraie réponse observée — pas juste
  "le code compile" ni "unit-testé avec un payload fabriqué à la main".

## Transport HTTP

- `curl` vers `/api/fc` → HTTP 403 HTML Akamai (constaté 2026-08-25).
- Node 20 `fetch` (undici) + UA Chrome + Referer `https://www.ea.com/` → JSON
  200 sur la box CoS (search United → clubId 2582784).
- Deno/Edge : ne fetch **pas** `proclubs.ea.com` ; POST vers hop Node CPC
  (`EA_HTTP_HOP_URL` + `EA_HTTP_HOP_SECRET`). Pas de proxy ClubsZone.
- CI : fetch mocké, aucun appel live EA.

## Matrice

| Capacité | Source | Endpoint | Statut | Testé réellement ? | Limitations connues |
|---|---|---|---|---|---|
| Rechercher un club par nom | `ea/proClubsAdapter.ts` (`searchClub`) via `eaGet` | `/allTimeLeaderboard/search?clubName=` | **B** | Unité mockée ; search confirm en prod Edge (PR #43) | Liste complète, jamais first-hit ; forme `clubs` vs tableau |
| Fiche club | `getClub` | `/clubs/info?clubIds=` | **B** | Unité mockée (payload indexé par clubId) | `customKit.crestAssetId` lu s'il est là |
| Stats club | `getClubStats` | `/clubs/overallStats?clubIds=` | **B** | Unité mockée | `titlesWon` souvent absent → null |
| Matchs récents | `getClubMatches` | `/clubs/matches?matchType=leagueMatch\|friendlyMatch\|playoffMatch` | **B** | Unité mockée ; fenêtre max 10 par type | Historique long = table `ea_imported_matches` (EA ne garde que N) |
| Effectif | `getClubMembers` | `/members/stats?clubId=` | **B** | Unité mockée | Identité = `name` / playername ; pas de login persona |
| Carrière membres | `getClubCareerStats` / `getPlayerCareerStats` | `/members/career/stats?clubId=` | **B** | Unité mockée | Endpoint club-scoped ; filtre playername côté CPC |
| Stats joueur sur fenêtre matchs | `getPlayerStats` + `aggregatePlayerStats` | dérivé de `/clubs/matches` | **B** | Unité mockée | Matching `username == playername` |
| Classement saison (`/currentSeasonLeaderboard` hors search) | — | non branché | **E** | — | Pas une famille inventée |
| `getPlayoffData` hors `/clubs/matches?matchType=playoffMatch` | stub | — | **C** | — | Playoffs = matchType déjà typé |

## Player Identity

Aucun identifiant joueur EA n'est un login CPC. Clé d'objet `players[clubId][playerId]`
= persona interne, jamais persistée comme compte. Rapprochement :
`users.username == playername` (`ea_identity_kind = USERNAME_EQUALITY`).

## Ingest CPC

- Tables (migration `0030_ea_proclubs_import.sql`, ne pas appliquer depuis l'agent) :
  `ea_imported_clubs`, `ea_imported_members`, `ea_imported_matches`.
- `source = unofficial_api_fc`, `unverified = true`.
- Dedup matchs : unique `(ea_club_id, platform, ea_match_id)`.
- `users.verified_stats.importedMatchIds` reste le skip du cache joueur caller.
- Liste EA vide → aucune ligne inventée.
- `link-ea-club` met à jour la ligne caller seulement.

## Résilience

| État | Où |
|---|---|
| Retries + timeout | `_shared/ea/http.ts` (`fetchEaJson`) |
| Fallback silencieux | adapter `catch` → `null` |
| Feature flag | `FEATURE_EA_STATS` |
| Hop Deno → Node | `_shared/ea.ts` `eaGet` |
