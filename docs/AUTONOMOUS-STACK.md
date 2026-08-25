# Pile autonome CPC — tip PR #14 (25 août 2026 après-midi)

**Produit :** ClubPro Connect = matchmaking **EA SPORTS FC 27 Pro Clubs** uniquement. Joueur = profil virtuel Pro Clubs. Club = équipe virtuelle Pro Clubs. Pas de football IRL, pas de stats EA inventées, pas d’Expo Go.

**Date :** 25 août 2026 après-midi.  
**Tip de la pile :** `cursor/qa-autonomous-stack-5884` (PR **#14**, tip `0a7f034`) — contient PR **#5** (LIVE UX compacte), PR **#6–#13**, le lien `match_results` (0027), **et** les PR imbriquées **#15–#21** (déjà mergées **dans** #14).  
**Base d’intégration :** `social-ea-foundations-phase-2` (PR **#2** merged — P0/P1 LIVE + safety/notifications — et PR **#3** merged — retab IA).  
**Ne pas merger PR #14** (ni #5–#13, ni #15–#21) vers `social-ea-foundations-phase-2`. Les PR **#15–#21** sont déjà dans le tip #14 ; ne pas les re-merger ailleurs.

**Ce document :** ce qui est **réellement** dans le tip après le 25 août après-midi, SQL prod, Edge, checklist iPhone, **prêt EAS iOS/Android** (config réelle, pas de build lancé). L’agent n’applique **pas** les migrations et ne merge **pas** les PR GitHub vers la base.

Ne pas force-push. Ne pas supprimer les tags `stable-pre-social-phase` / `stable-social-foundations`. Pas d’EAS build, pas de secrets dans git, pas d’Expo Go, pas de submit Apple/Play.

---

## 0. Inventaire réel — 25 août après-midi

| Item | État réel au tip `0a7f034` |
|---|---|
| **0027** `opponent_club_id` + `competition_id` ; classement compétition **seulement** depuis des `match_results` liés | **Appliqué en prod** par CoS sur le PC fondateur (projet `cfgvtyxiggewauevvigm`). Pas d’horodatage de deploy dans git. |
| **0028** conversation club (`start_club_conversation` + sync `club_members`) | **Appliqué** par CoS sur le PC fondateur (même projet). |
| Edge `start-club-conversation` | **Déployée** par CoS (PC fondateur). |
| Notifs `MATCH_FINALIZED` + `COMPETITION_CLUB_REGISTERED` | **Dans le code** du tip. Edges `finalize-match` et `register-competition-club` **redéployées** par CoS (PC fondateur). Pas de SQL dédié notif (`notifications.type` = texte libre 0025). |
| **0029** tournois V1 (`competitions.kind` + `tournament_matches`) | **À appliquer par CoS** (Option B). Pas encore en prod tant que non exécuté. |
| Block sur recherche d’adversaire + annuaire clubs | **Dans le tip** (PR #18). Même règle LIVE/matching, les deux sens. |
| Historique de matchs réel ClubPro Card / profil club | **Dans le tip** (PR #19). `finalize_match` seulement ; vide honnête ; jamais un faux 0-0. |
| Clavier sur sheets (LIVE / filtres / finalisation) | **Dans le tip** (PR #20). Android `softwareKeyboardLayoutMode: resize` → **rebuild Dev Client** pour l’appliquer. |
| Perf : borne historique + SmartMatchBanner | **Dans le tip** (PR #21). Lookback joueur 40 / affichage 5. Banner = props du parent, **pas** de 2ᵉ `useLiveSessions` / canal `live-feed`. |
| PR imbriquées **#15–#21** | **Mergées dans #14** (GitHub). **Pas** mergées dans `social-ea-foundations-phase-2`. |
| Test iPhone | **Encore à faire** (EAS Dev Client). **Pas d’Expo Go.** |
| Ligues ranking | **Toujours off** (`canShowLiveLeagueRanking()` false ; `season_stats` ≠ `match_results`). |
| Passer Pro | **Toujours désactivé** (`FEATURE_REVENUECAT` off → CTA FR, pas de paiement fictif). |
| Brackets / tournois | **V1** : kind TOURNAMENT sur `competitions` + `tournament_matches` persistés. Scores seulement depuis `match_results` liés. SQL **0029 à appliquer**. |
| Quota fictif | **Aucun** inventé. Gating Free réel = `FREE_APPLICATIONS_PER_DAY` (3) côté `apply`. Pas de jauge théâtre, pas de quota Pro simulé. |

---

## 1. Graphe réel (bases GitHub)

```
social-ea-foundations-phase-2
 ├── PR #5  cursor/player-live-ux-overhaul-8a6e     LIVE UX compact     SŒUR de #6 — INTEGREE dans le tip #14
 ├── PR #4  (fix manager feuille / canaux)          hors pile #5–#21
 └── PR #6  cursor/player-club-profile-726b         profils
      └── PR #7  cursor/sessions-teams-0f8a         sessions / effectif
           └── PR #8  cursor/social-chat-groups-89d0  chat + groupes
                └── PR #9  cursor/competitions-foundation-08b2  compétitions + 0026
                     └── PR #10 cursor/dm-message-received-notify-2717  notif DM
                          └── PR #11 cursor/notify-mark-all-read-b782  tout marquer lu
                               └── PR #12 cursor/profile-edit-identity-c408  édition profil
                                    └── PR #13 cursor/club-edit-identity-fb68  édition club
                                         └── PR #14 cursor/qa-autonomous-stack-5884  tip
                                              ├── (merge git) PR #5 LIVE UX
                                              ├── 0027 lien match → club adverse + compétition
                                              ├── PR #15 club conversation + recruitment   MERGÉE dans #14
                                              ├── PR #16 MATCH_FINALIZED                   MERGÉE dans #14
                                              ├── PR #17 COMPETITION_CLUB_REGISTERED       MERGÉE dans #14
                                              ├── PR #18 block opponent search / directory MERGÉE dans #14
                                              ├── PR #19 historique matchs réels           MERGÉE dans #14
                                              ├── PR #20 clavier sheets                    MERGÉE dans #14
                                              └── PR #21 perf history + SmartMatchBanner   MERGÉE dans #14
```

**PR #5 est dans le tip.** Merge git local `origin/cursor/player-live-ux-overhaul-8a6e` → `cursor/qa-autonomous-stack-5884` (pas un merge GitHub des PR #5–#14). Conflits club LIVE : UX sheet PR #5 + mapping session PR #7 (`clubSessionSnapshot` / `canManage`). Profils / éditeurs : pile #6–#13.

**PR #15–#21 sont dans le tip.** Merges GitHub **vers** `cursor/qa-autonomous-stack-5884` seulement. **Ne pas** merger #14 (ni ces nested) dans `social-ea-foundations-phase-2`.

LIVE dans le tip = PR **#2** (expiry, LIVE joueur/club, matching, apply) + PR **#3** (onglets) + PR **#5** (UX compacte OFF/ON, sheets, filtres, `test:live-filters`) + PR **#7** (TTL vs feuille de match).

Tip vs `social-ea-foundations-phase-2` (`c0f88ea`, merge-base = tip fondations) : **39 commits** ahead, **0** behind. Toujours **pas** de merge GitHub vers la base.

---

## 2. Ordre des PR dans le tip

| Ordre | PR | Branche | Base GitHub | Dans le tip #14 ? | Rôle |
|---|---|---|---|---|---|
| — | **#5** | `cursor/player-live-ux-overhaul-8a6e` | `social-ea-foundations-phase-2` | **Oui** (merge git dans #14) | UX LIVE compacte, sans fake scores |
| 1 | **#6** | `cursor/player-club-profile-726b` | `social-ea-foundations-phase-2` | Oui | Profil joueur + profil club (données réelles) |
| 2 | **#7** | `cursor/sessions-teams-0f8a` | branche #6 | Oui | LIVE TTL vs feuille de match, roster réel |
| 3 | **#8** | `cursor/social-chat-groups-89d0` | branche #7 | Oui | DM + groupes sur le stack chat existant |
| 4 | **#9** | `cursor/competitions-foundation-08b2` | branche #8 | Oui | Compétitions virtuelles (tables + Edge) |
| 5 | **#10** | `cursor/dm-message-received-notify-2717` | branche #9 | Oui | Notif in-app `MESSAGE_RECEIVED` sur DM réel |
| 6 | **#11** | `cursor/notify-mark-all-read-b782` | branche #10 | Oui | Tout marquer lu |
| 7 | **#12** | `cursor/profile-edit-identity-c408` | branche #11 | Oui | Éditer son identité Pro Clubs |
| 8 | **#13** | `cursor/club-edit-identity-fb68` | branche #12 | Oui | Éditer l’identité de son club (OWNER) |
| 9 | **#14** | `cursor/qa-autonomous-stack-5884` | branche #13 | **Tip** | Lien 0027 + intégration #5 + nested #15–#21 |
| 10 | **#15** | `cursor/club-conversation-recruitment-1241` | #14 | **Oui (merged into #14)** | Conversation club (0028) + tap Recrutement |
| 11 | **#16** | `cursor/match-finalized-notify-1207` | #14 | **Oui (merged into #14)** | Notif `MATCH_FINALIZED` après RPC |
| 12 | **#17** | `cursor/competition-club-registered-notify-e711` | #14 | **Oui (merged into #14)** | Notif `COMPETITION_CLUB_REGISTERED` |
| 13 | **#18** | `cursor/fix-safety-block-opponent-search-f899` | #14 | **Oui (merged into #14)** | Block recherche adversaire + annuaire |
| 14 | **#19** | `cursor/feat-profile-match-history-d47d` | #14 | **Oui (merged into #14)** | Historique réel ClubPro Card / club |
| 15 | **#20** | `cursor/sheets-keyboard-safe-area-f9d3` | #14 | **Oui (merged into #14)** | Sheets utilisables clavier ouvert |
| 16 | **#21** | `cursor/perf-query-waste-5fd3` | #14 | **Oui (merged into #14)** | Borne history + banner sans 2ᵉ live-feed |

---

## 3. Ce qu’il ne faut **pas** merger

**Ne pas merger PR #14** vers `social-ea-foundations-phase-2`.  
**Ne pas merger** les PR GitHub #5–#13 en parallèle vers cette base (doublon avec le tip).  
**Ne pas re-merger** #15–#21 : elles sont déjà **dans** #14.

Hors séquence : PR **#1** (env cloud), PR **#4** (fix manager). Ne pas les glisser dans cette pile.

---

## 4. Migrations prod (Option B)

Source SQL = `supabase/migrations/`. Miroir Prisma dans `schema.prisma` seulement — **ne pas** `prisma migrate deploy` pour 0021–0029 (double-apply).

L’agent **n’applique pas** le SQL en production. Projet distant réel : `cfgvtyxiggewauevvigm` (`supabase/config.toml`).

**0027 et 0028 : appliqués en prod par CoS sur le PC fondateur.** Pas d’horodatage de deploy dans git / commentaires de commit. Commandes historiques (déjà exécutées par CoS, **ne pas les relancer** tant que le distant les a) :

```bash
npx prisma db execute --file supabase/migrations/0026_competitions_foundation.sql --schema prisma/schema.prisma
npx prisma db execute --file supabase/migrations/0027_match_result_competition_link.sql --schema prisma/schema.prisma
npx prisma db execute --file supabase/migrations/0028_club_conversation.sql --schema prisma/schema.prisma
```

0026 est le prérequis de 0027 (`competitions` / `competition_clubs`). 0027 en prod implique 0026 en place. **Windows :** PowerShell, même commande `npx prisma db execute --file ...` (pas `prisma migrate deploy`).

**0029 tournois V1 — à appliquer par CoS (pas l'agent) :**

```bash
npx prisma db execute --file supabase/migrations/0029_tournaments_v1.sql --schema prisma/schema.prisma
```

Puis :

```bash
npx supabase functions deploy create-tournament schedule-tournament-round
npx supabase functions deploy create-competition register-competition-club
```

Sans 0029 : `kind` / `tournament_matches` absents → liste/création tournoi échoue. Ne **pas** `prisma migrate deploy`. Ligues inchangées (`season_stats` off).

| Fichier | Origine | Rôle | Prod 25 août après-midi |
|---|---|---|---|
| `0021_live_expiry_player_live.sql` | PR #2 (merged dans la base) | `expires_at`, `player_sessions`, unique PENDING apply | déjà (base #2) |
| `0022_recruitment_status_enums.sql` | PR #2 | ENUM DECLINED / CANCELLED / EXPIRED | déjà |
| `0023_expire_live_janitor.sql` | PR #2 | RPC janitor + pg_cron optionnel | déjà |
| `0024_apply_live_match_rls.sql` | PR #2 | CHECK LIVE + trigger apply + RLS manager | déjà |
| `0025_safety_notifications.sql` | PR #2 | `user_blocks` / `user_reports` / `notifications` + RPC | déjà |
| `0026_competitions_foundation.sql` | PR #9 | `competitions` + `competition_clubs` (unique paire) | prérequis de 0027 |
| **`0027_match_result_competition_link.sql`** | **PR #14** | **`match_results.opponent_club_id` + `competition_id` (nullable FKs). CHECK adverse ≠ club. Trigger : si compétition, les deux clubs sont dans `competition_clubs`. `finalize_match` étendu. Pas de table standings.** | **Appliqué par CoS (PC fondateur)** |
| **`0028_club_conversation.sql`** | **PR #15** | **Get-or-create conversation `CLUB` (RPC `start_club_conversation`) + sync `club_members` → `conversation_members`. Pas de nouvelle table / pas de 2e chat.** | **Appliqué par CoS (PC fondateur)** |
| **`0029_tournaments_v1.sql`** | Tournois V1 | **`competitions.kind` COMPETITION\|TOURNAMENT + `tournament_matches` (paires SCHEDULED\|PLAYED) + `tournament_round_clubs` (pool par tour). Pas de table `tournaments` dupliquée. Pas de scores sur les paires. PLAYED via trigger `match_results`. Vainqueur = finale PLAYED.** | **À appliquer par CoS** |

Sans 0027 : `finalize-match` enverrait `p_opponent_club_id` / `p_competition_id` vers une RPC 0014 qui ne les connaît pas — **ce n’est plus le cas en prod** (0027 appliqué + Edge redéployée).  
Sans 0028 : le bouton Conversation du club échouerait — **ce n’est plus le cas en prod** (0028 + `start-club-conversation` déployée).

Pas de migration dédiée pour `MESSAGE_RECEIVED`, `MATCH_FINALIZED` ni `COMPETITION_CLUB_REGISTERED` : `notifications.type` est du texte libre (0025, CHECK `char_length(type) > 0` seulement — pas d’enum PG).  
PR **#5** / **#18–#21** : aucune migration (UX / safety client / history / clavier / perf).

---

## 5. Edge Functions

Inventaire invocables par l’app (déclarées dans `supabase/config.toml`, `verify_jwt = true` sauf crons / webhook). L’agent **ne déploie pas**.

**Redéployées / déployées par CoS sur le PC fondateur (projet `cfgvtyxiggewauevvigm`), 25 août après-midi — pas d’horodatage git :**

- `start-club-conversation` — get-or-create conversation CLUB (0028)
- `finalize-match` — 0027 (`opponentClubId` / `competitionId`) **et** notif `MATCH_FINALIZED`
- `register-competition-club` — notif `COMPETITION_CLUB_REGISTERED` après INSERT réel

Liste complète (à redéployer seulement si le distant n’a pas la version du tip) :

```bash
npx supabase functions deploy \
  block-user \
  unblock-user \
  report-user \
  apply \
  respond-application \
  respond-invitation \
  respond-transition-invitation \
  request-departure \
  respond-departure \
  release-member \
  invite-to-club \
  invite-to-slot \
  launch-match-checkin \
  finalize-match \
  expire-live-sessions \
  create-competition \
  register-competition-club \
  create-tournament \
  schedule-tournament-round \
  notify-message-received \
  start-club-conversation
```

| Fonction | JWT gateway | Pourquoi |
|---|---|---|
| `block-user` / `unblock-user` / `report-user` | `verify_jwt = true` | Safety 0025 |
| `apply` | true | Candidature LIVE |
| `respond-application` / `respond-invitation` / `respond-transition-invitation` | true | Réponses recrutement / transition |
| `request-departure` / `respond-departure` / `release-member` | true | Départ / libération (onglet Club) |
| `invite-to-club` / `invite-to-slot` | true | Invitations |
| `launch-match-checkin` | true | Session LIVE → check-in (`match_checkins`) |
| `finalize-match` | true | Check-in → `match_results` (score / outcome serveur / club adverse / compétition optionnelle) + notif in-app `MATCH_FINALIZED` après RPC |
| `expire-live-sessions` | **`verify_jwt = false`** (auth `CRON_SECRET`) | Janitor LIVE ; pg_cron SQL 0023 est l’alternative |
| `create-competition` / `register-competition-club` | true | Fondation #9. `register-competition-club` notifie `COMPETITION_CLUB_REGISTERED` (après INSERT réel). `create-competition` pose `kind=COMPETITION`. |
| `create-tournament` / `schedule-tournament-round` | true | Tournois V1 (0029). Création kind=TOURNAMENT ; 1er tour persisté dans `tournament_matches`. |
| `notify-message-received` | true | Notif in-app DM (#10) |
| `start-club-conversation` | true | Get-or-create conversation CLUB (0028) |

Sans `notify-message-received` : le message s’insère quand même (INSERT client + RLS) ; **pas** de ligne `notifications` `MESSAGE_RECEIVED`.  
Sans **redéploiement `finalize-match`** (cette notif) : le résultat s’écrit quand même ; **pas** de ligne `notifications` `MATCH_FINALIZED`. Échec notify ≠ rollback du `match_results` (comme le DM). **Redéployé par CoS.**  
Sans **redéploiement `register-competition-club`** (cette notif) : l’inscription s’écrit quand même ; **pas** de ligne `notifications` `COMPETITION_CLUB_REGISTERED`. Échec notify ≠ rollback de `competition_clubs`. **Redéployé par CoS.**  
Sans `create-competition` : pas de création compétition.  
Sans `launch-match-checkin` / `finalize-match` : la feuille `/match` affiche le check-in, mais lancer / enregistrer un résultat échoue (Edge absente).  
`expire-live-sessions` : si pg_cron 0023 est actif, le SQL janitor tourne déjà ; l’Edge reste l’invoke HTTP documenté.

Autres Edge déjà dans le README (`smart-match`, `start-direct-conversation`, `create-group`, `set-group-member-role`, `link-ea-club`, …) : les redéployer si le distant n’a pas la version de cette pile.

---

## 6. QA cloud — tip #14

### 6.1 P0 stabilize (25 août 2026, avant nested #15–#21)

Relance **complète** sur `cursor/qa-autonomous-stack-5884` (`61f34a3` + commits P0). Aucun échec. Moteurs LIVE / matching / apply / invite **non retouchés**. Ligues ranking **non restauré**. Passer Pro **toujours désactivé**. Onglets inchangés : Joueur LIVE \| Activité \| Profil · Club LIVE \| Recrutement \| Club.

| Commande | Résultat (P0, `61f34a3`) |
|---|---|
| `npm run typecheck` | **PASS** |
| `npm run test:live` | **PASS** (14) |
| `npm run test:live-match` | **PASS** (15) |
| `npm run test:live-filters` | **PASS** (6) |
| `npm run test:recruitment` | **PASS** (5) |
| `npm run test:safety` | **PASS** (13) |
| `npm run test:session-state` | **PASS** (10) |
| `npm run test:club-profile` | **PASS** (10) |
| `npm run test:leagues` | **PASS** (5) |
| `npm run test:competitions` | **PASS** (12 — scorer + lien 0027) |
| `npm run test:social` | **PASS** (5) |
| `npm run test:notification-read` | **PASS** (3) |
| `npm run test:profile-identity` | **PASS** (7) |
| `npm run test:club-identity` | **PASS** (7) |
| `npm run test:player-card` | **PASS** (9) |
| `npm run test:ovr` | **PASS** (9) |
| `npm run test:reliability` | **PASS** (8) |
| `npm run test:ea-normalize` | **PASS** (19) |
| `npm run test:m2-player-search` | **PASS** (8) |

Travail incomplet **réel** à ce P0 (pas des faux positifs) — **plusieurs ont été fermés l’après-midi** (voir §0 / §6.4).

### 6.2 P0 Realtime (post-merges #5–#13) — 24 août 2026

**Verdict : déjà correct.** Pas de second `.channel(topic)` sans Map ref-comptée. Fix `7046a8f` intact. Matching / TTL / RLS / apply inchangés. PR #21 n’ajoute **pas** de 2ᵉ canal `live-feed` : `SmartMatchBanner` lit les sessions du parent.

| Topic | Table | Acquire | Montages qui partagent |
|---|---|---|---|
| `live-feed` | `club_sessions` | `useLiveSessions` | LIVE joueur, FindClubPanel, deep link `/clubs`. **Plus** SmartMatchBanner (props). |
| `live-players` | `player_sessions` | `useLivePlayers` | LIVE joueur, Recrutement club |
| `my-player-session-${userId}` | `player_sessions` (filtre `user_id`) | `useMyPlayerSession` | PlayerLivePanel — **autre nom** que `live-players` |
| `notifications-${userId}` | `notifications` | `useNotifications` | `_layout` SafetyRealtimeBridge, badge tabs, Activité, Recrutement, `/notifications` |
| `messages-${conversationId}` | `messages` | `useMessages` | `/conversation/[id]` seulement. `useConversations` : **pas** de Realtime |

Crash visé : `supabase.channel(topic)` réutilise l’instance ; un 2ᵉ `.on()` après `.subscribe()` plante. Un canal réel par topic, listeners en Set.

### 6.3 Session → match → résultat → compétition (0027) — **en prod**

Le moteur **existe**, le **lien compétition** est dans le schéma, **0027 appliqué** (CoS, PC fondateur).

```
LIVE club (is_live + expires_at)
  → feuille /match (roster réel, invite-to-slot)
  → launch-match-checkin  → match_checkins + match_participations
  → finalize-match        → match_results
       our_score, opponent_score, outcome (serveur), mvp
       opponent_club_id (FK clubs, CHECK ≠ club_id)
       competition_id (FK competitions, optionnel)
  → Classement /competitions : UNIQUEMENT si ≥1 ligne avec
       competition_id ET opponent_club_id
       W=3 / D=1 / L=0, les deux clubs crédités, pas de season_stats
```

Ne **pas** inventer de classement. Ne **pas** remplir Ligues depuis `season_stats` / seed / EA. `canShowLiveLeagueRanking()` reste false tant que `season_stats` n’est pas agrégé depuis `match_results`.

Recherche d’adversaire (`useClubNameSearch`) et annuaire (`useClubsList`) : clubs dont l’owner est dans le set de blocs bidirectionnel **cachés** (PR #18). Compétitions liste/inscription = **noms seulement**, pas de CTA contact ajouté.

### 6.4 Nested #15–#21 — tests rapportés par PR (pas une relance P0 ici)

Comptes `test()` dans les scripts **au tip `0a7f034`**. PASS cités = ceux des PR imbriquées, pas une nouvelle batterie complète de ce document.

| PR | Commandes rapportées PASS | `test()` au tip |
|---|---|---|
| #15 | `test:social` (7), `test:recruitment` (8), `typecheck` | social 7, recruitment 8 |
| #16 | `test:safety` (11 à cette révision), `test:recruitment` (8) | — |
| #17 | `test:safety` (13), `test:recruitment` (8) | — |
| #18 | `test:safety`, `test:competitions`, `test:social`, `typecheck` | safety **15** au tip |
| #19 | `test:match-history` (16), `tsc` | match-history ensuite 17 (#21) |
| #20 | `typecheck` | (pas de nouveau script) |
| #21 | `typecheck`, `test:match-history` (17), `test:live` (14), `test:live-match` (15), `test:player-card` (9) | match-history **17** |

`test:competitions` au tip : **13** `test()` (12 au P0 + contrat contact / SQL 0027 déjà dans le tip).  
`test:match-history` : script ajouté PR #19, **17** au tip (lookback / limite).

Cette révision docs **ne relance pas** `typecheck` / `test:*` (docs-only).

---

## 7. Ce que le fondateur doit tester sur iPhone

**Toujours à faire.** EAS Dev Client uniquement (`eas build --profile development`). Pas Expo Go (modules natifs : notifications, RevenueCat). Pas de simulateur cloud ici.

Compte réel (onboarding terminé) + second compte pour DM / block / apply.

### LIVE (base #2 + UX #5 + #7)

- Joueur **OFF** : carte compacte « Tu veux jouer maintenant ? » → PASSER LIVE → **sheet** (poste/plateforme profil + durée obligatoire, note optionnelle). Pas de formulaire géant.
- Joueur **ON** : carte statut compacte (poste, plateforme, countdown, Modifier / Quitter le LIVE). Expire → retour OFF.
- Trouver un club : cartes opportunité (sessions LIVE réelles), filtres compacts `[Poste ▾] [Plateforme ▾] [Niveau ▾]` + Filtres (langue). Compteur honnête. Empty : **Élargir la recherche** (modèle existant, aucun club inventé). Smart match : motifs déterministes, **pas de %**. Banner = **même liste** que FindClubPanel (pas un 2ᵉ fetch).
- Club (OWNER/MANAGER) : carte compacte OFF/ON + sheet postes/durée. Postes **toujours requis**. Mapping session : recrutement LIVE (`is_live` + TTL) **distinct** du match lancé (check-in).
- **Clavier** : sheets LIVE / filtres / finalisation restent utilisables (champs au-dessus du clavier, 44 pt). iOS = `KeyboardAvoidingView` padding offset 0. Android sheets = `height` (Modal transparent). Finalisation in-tab Android = `windowSoftInputMode` **resize** — **rebuild Dev Client Android** si le binaire n’a pas encore `softwareKeyboardLayoutMode: "resize"` (`app.json`).

### Profils (#6) + historique (#19 / #21)

- Onglet Profil : ClubPro Card = username, plateforme, postes, plan. Badge EA = `USERNAME_EQUALITY` ou `NONE`, jamais « verified player id ».
- **OVR CPC** labellisé (formule produit). Stats EA seulement si identité `USERNAME_EQUALITY` **et** au moins un chiffre stocké.
- **Derniers matchs** : jusqu’à 5 lignes `finalize_match` via PRESENT `match_participations` → `match_results` (lookback 40 check-ins). Empty : **Pas encore de match enregistré**. Score seulement si les deux scores sont des nombres réels. Un 0–0 DRAW persisté s’affiche ; un score manquant ne devient **pas** un faux 0-0.
- Onglet Club / `/club/[id]` : nom, niveau, plateforme **du owner** (pas de colonne `clubs.platform`), LIVE réel, effectif `club_members`, historique `match_results.club_id` (limite 5).

### Sessions / effectif (#7)

- Recrutement LIVE et « match lancé » (check-in sans `match_results`) peuvent coexister — pas d’enum OPEN/FULL.
- Feuille `/match` : roster réel, slot vide → recherche → `invite-to-slot`. Check-in via `launch-match-checkin`. Finaliser : scores + **club adverse CPC réel** (recherche, pas un nom libre ; **blocs honorés**) + compétition **optionnelle** (OPEN où les deux clubs sont inscrits). Outcome serveur.

### Social (#8 + #15)

- Depuis un profil : vrai DM (`start-direct-conversation`) → `/conversation/[id]`. Realtime, pas de pull-to-refresh obligatoire.
- Joueur bloqué : pas de DM, copy « Tu ne peux pas envoyer de message à ce joueur (blocage). »
- Groupes : liste + détail. Pas de 4e onglet.
- Conversation type **CLUB** : bouton **Conversation du club** (44 pt) sur l’onglet Club, get-or-create `start-club-conversation` → `/conversation/[id]`. **0028 + Edge déjà en prod.** `MESSAGE_RECEIVED` skippe toujours GROUP/CLUB.
- Recrutement : tap `APPLICATION_RECEIVED` sélectionne le club, passe en Mode Club, ouvre `/candidatures`. Boutons **Accepter** / **Refuser** (44 pt). Cache effectif après accept.

### Compétitions (#9 + 0027) — 0026 + 0027 + `finalize-match` en prod

- Créer une compétition (DRAFT ou OPEN), la voir dans la liste.
- OWNER/MANAGER : inscrire un club géré sur une OPEN. Doublon → **409**, pas une 2ᵉ ligne.
- Classement **seulement** s’il existe au moins un `match_results` avec `competition_id` **et** `opponent_club_id`. Sinon copy honnête, **pas** de rows 0-0-0, **pas** de `season_stats`.
- **Tournois V1** : même table, `kind=TOURNAMENT`. Stack `/tournaments/[id]`. Tableau = paires `tournament_matches` uniquement. Tours : 1er depuis clubs inscrits ; suivants depuis vainqueurs **PLAYED** (+ pool `tournament_round_clubs`). Vainqueur du tournoi = finale persistée (1 match, pool 2, résultat lié). Unplayed = « pas encore joué ».

### Notifications (#10 + #11 + MATCH_FINALIZED + COMPETITION_CLUB_REGISTERED)

- Compte A envoie un **vrai** DM DIRECT à B → B reçoit une notif in-app « Nouveau message » / « {pseudo} t'a écrit. » Tap → la conversation. Pas de notif pour GROUP/CLUB. Échec notify ≠ rollback du message.
- Activité / `/notifications` : **Tout marquer lu** (44 pt) → badge Activité à **0**. Déjà-lues inchangées.
- **Résultat réel** (`finalize-match` après RPC, Edge redéployée) : notif `MATCH_FINALIZED` « Résultat de match » / « {club} 3 — 1 {adverse}. » aux membres des deux clubs **sauf le recorder**. Tap → `/match` (Mode Club) ou `/competitions` si `competition_id`. Realtime = canal `notifications` existant. Échec notify ≠ rollback du résultat.
- **Inscription réelle** (`register-competition-club` après INSERT, Edge redéployée) : notif `COMPETITION_CLUB_REGISTERED` « Club inscrit » / « {club} s'est inscrit à {compétition}. » au `created_by` de la compétition et aux OWNER/MANAGER du club inscrit (une seule notif si le même user). Tap → `/competitions`. Échec notify ≠ rollback de l’inscription. Pas de notif `COMPETITION_CREATED` (le créateur voit déjà l’écran).

### Édition profil (#12)

- **Modifier mon identité Pro Clubs** sur son Profil → `/edit-profile`.
- Username / plateforme / postes / style / langues / dispo. La ClubPro Card se met à jour.
- Impossible d’envoyer fiabilité, stats EA, `ea_identity_kind`, plan, OVR.

### Édition club (#13)

- OWNER : **Modifier l'identité du club** sur l’onglet Club → `/edit-club` (nom, niveau, langues, description, vocal).
- MANAGER : bouton masqué ; l’écran refuse (RLS `clubs_update_owner`). Pas de colonne `clubs.platform`. Pas d’édition `owner_id` / formation / `ea_club_id`.

### Safety (0025 + Edge block/report + #18)

- Bloquer B → B disparaît du LIVE / matching / messages (bidirectionnel). Débloquer = seulement **mes** blocs.
- Signaler : motif du formulaire, report **OPEN** visible pour le reporter.
- Recherche d’adversaire (finalisation) et **annuaire** : club dont l’owner est bloqué (dans les deux sens) **absent**. Compétitions : noms seulement, pas de CTA Message inventé.

### Hors scope à ne pas « tester comme livré »

- Expo Go, CPCP, stats EA inventées.
- Classement Ligues (`season_stats` / `/leagues`) — **toujours off**.
- Passer Pro — **toujours désactivé** (pas de paiement fictif, pas de quota Pro simulé).
- Bracket décoratif / clubs inventés / 0-0 sur un match non joué — **interdit**.
- Quota fictif — **aucun** (seul le plafond Free réel 3 candidatures / jour côté `apply`).

---

## 8. Trous encore ouverts (honnêtes)

| Item | État |
|---|---|
| Test iPhone Dev Client | **À faire.** Pas Expo Go. |
| Android clavier resize | Code + `app.json` dans le tip ; **rebuild Dev Client** si le binaire actuel n’a pas la config native. |
| Ligues ranking | **Off.** `canShowLiveLeagueRanking()` false. Pas de `season_stats` depuis `match_results`. |
| Passer Pro | **Désactivé.** `FEATURE_REVENUECAT` off. |
| Tournois V1 | **Code dans cette branche.** SQL **0029 + Edges à déployer par CoS**. Pas de round 2 auto, pas de seed. |
| Quota fictif | **Pas inventé.** |
| Merge #14 → `social-ea-foundations-phase-2` | **Interdit** pour cette pile. |

---

## 9. EAS iOS / Android — déjà configuré vs humain

Lu dans le tip : `eas.json`, `app.json`, `package.json`. **Pas** de fichier `app.config.js` / `app.config.ts` (config Expo = `app.json` seulement). Aucun `eas build` / `eas submit` exécuté ici.

### Déjà dans le repo

| Élément | Valeur réelle |
|---|---|
| Expo | `expo` **~57.0.13**, `expo-dev-client` **~57.0.12** (`package.json`) |
| `eas-cli` | **absent** de `dependencies` / `devDependencies`. Scripts `build:*` / `submit:*` appellent `eas` (install globale README : `npm install -g eas-cli`) |
| `eas.json` CLI | `"version": ">= 13.0.0"`, `"appVersionSource": "remote"` |
| Profil `development` | `developmentClient: true`, `distribution: "internal"`, iOS `resourceClass: "m-medium"` |
| Profil `preview` | `distribution: "internal"`, `channel: "preview"` |
| Profil `production` | `autoIncrement: true`, `channel: "production"` |
| Slug / owner | `clubpro-connect` / `k64selim` (`app.json`) |
| `extra.eas.projectId` | **présent** : `67b7875c-ab0e-4d3d-ab1e-43a4a164d127` |
| iOS `bundleIdentifier` | `com.clubproconnect.app` |
| Android `package` | `com.clubproconnect.app` |
| Android clavier | `softwareKeyboardLayoutMode`: **`resize`** (`app.json`) — native, rebuild Dev Client |
| Dossiers natifs | **aucun** `ios/` ni `android/` (workflow managed) |
| Gitignore credentials | `.eas/`, `*.p8`, `*.p12`, `*.jks`, `*.key`, `*.mobileprovision` |

Scripts npm : `build:dev` → `eas build --profile development` ; `build:preview` ; `build:prod` ; `submit:ios` / `submit:android`.

### Humain (compte Apple / Expo / Play — pas un agent)

- **`eas login`** sur le compte Expo owner `k64selim` (ou membre du projet `67b7875c-ab0e-4d3d-ab1e-43a4a164d127`). `eas init` n’est plus nécessaire : le `projectId` est déjà dans `app.json`.
- **Apple Developer Program** + équipe réelle. `eas.json` → `submit.production.ios` est encore des **placeholders** : `appleId` `TON_APPLE_ID@exemple.com`, `ascAppId` `TODO_APP_STORE_CONNECT_APP_ID`, `appleTeamId` `TODO_APPLE_TEAM_ID`.
- **Credentials iOS** (certificats / profils) : gérés par EAS après login, **pas** dans git.
- **Android Play** : `serviceAccountKeyPath` pointe vers `./google-service-account.json` — **fichier absent du repo** (correct). Ne pas le committer. Track `internal` seulement.
- **Premier Dev Client** : `eas build --profile development` (iOS et/ou Android) **par un humain**, device réel, puis `npx expo start --dev-client`. Pas Expo Go (notifications, RevenueCat). Rebuild Android après le slice clavier (#20) si le binaire n’a pas `resize`.
- **Store** : submit **non prêt** (placeholders Apple + JSON Play manquant). Ne pas `eas submit`, ne pas publier App Store / Play.
