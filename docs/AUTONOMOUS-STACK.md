# Pile autonome CPC — PR #5 à #14

**Produit :** ClubPro Connect = matchmaking **EA SPORTS FC 27 Pro Clubs** uniquement. Joueur = profil virtuel Pro Clubs. Club = équipe virtuelle Pro Clubs. Pas de football IRL, pas de stats EA inventées, pas d’Expo Go.

**Date QA :** 25 août 2026 (lien match → club adverse + compétition) — P0 stabilize le même jour.  
**Tip de la pile :** `cursor/qa-autonomous-stack-5884` (PR **#14**) — contient **PR #5** (LIVE UX compacte) **et** PR **#6–#13**, plus le lien `match_results` (0027).  
**Base d’intégration :** `social-ea-foundations-phase-2` (contient déjà PR **#2** merged — P0/P1 LIVE + safety/notifications — et PR **#3** merged — retab IA).  
**Ce document :** ordre de merge, SQL prod, Edge à déployer, checklist iPhone, **prêt EAS iOS/Android** (config réelle, pas de build lancé). L’agent n’applique **pas** les migrations et ne merge **pas** les PR GitHub vers la base.

Ne pas force-push. Ne pas supprimer les tags `stable-pre-social-phase` / `stable-social-foundations`. Pas d’EAS build, pas de secrets dans git, pas d’Expo Go, pas de submit Apple/Play.

---

## 1. Graphe réel (bases GitHub)

```
social-ea-foundations-phase-2
 ├── PR #5  cursor/player-live-ux-overhaul-8a6e     LIVE UX compact     SŒUR de #6 — INTEGREE dans le tip #14
 ├── PR #4  (fix manager feuille / canaux)          hors pile #5–#13
 └── PR #6  cursor/player-club-profile-726b         profils
      └── PR #7  cursor/sessions-teams-0f8a         sessions / effectif
           └── PR #8  cursor/social-chat-groups-89d0  chat + groupes
                └── PR #9  cursor/competitions-foundation-08b2  compétitions + 0026
                     └── PR #10 cursor/dm-message-received-notify-2717  notif DM
                          └── PR #11 cursor/notify-mark-all-read-b782  tout marquer lu
                               └── PR #12 cursor/profile-edit-identity-c408  édition profil
                                    └── PR #13 cursor/club-edit-identity-fb68  édition club
                                         └── PR #14 cursor/qa-autonomous-stack-5884  tip = #6–#13 + merge git PR #5
```

**PR #5 est dans le tip.** Merge git local `origin/cursor/player-live-ux-overhaul-8a6e` → `cursor/qa-autonomous-stack-5884` (pas un merge GitHub des PR #5–#14, pas de merge dans `social-ea-foundations-phase-2`). Conflits club LIVE : UX sheet PR #5 + mapping session PR #7 (`clubSessionSnapshot` / `canManage`). Profils / éditeurs : pile #6–#13.

LIVE dans le tip = PR **#2** (expiry, LIVE joueur/club, matching, apply) + PR **#3** (onglets) + PR **#5** (UX compacte OFF/ON, sheets, filtres, `test:live-filters`) + PR **#7** (TTL vs feuille de match).

---

## 2. Ordre des PR #5–#13

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

---

## 3. Ce qu’il faut merger, dans l’ordre

**Ne pas merger les PR GitHub en parallèle** vers `social-ea-foundations-phase-2`. Ne pas merger GitHub PRs #5–#14 comme merge GitHub.

### Pile du tip (à poser sur `social-ea-foundations-phase-2`)

Le tip `cursor/qa-autonomous-stack-5884` contient déjà **#5** (UX LIVE) **et** #6–#13. Un seul merge de ce tip dans `social-ea-foundations-phase-2` pose toute la pile. Ne pas merger ensuite #5 ni #6–#13 (doublon).

Hors séquence : PR **#1** (env cloud), PR **#4** (fix manager). Ne pas les glisser dans cette pile.

---

## 4. Migrations prod (Option B)

Source SQL = `supabase/migrations/`. Miroir Prisma dans `schema.prisma` seulement — **ne pas** `prisma migrate deploy` pour 0021–0027 (double-apply).

L’agent **n’applique pas** le SQL en production. Le fondateur / CoS applique **dans l’ordre**, après 0002–0020 déjà en place.

**Option B (0026 et 0027)** — même commande, depuis la racine du repo, avec `DATABASE_URL` (Direct) :

```bash
npx prisma db execute --file supabase/migrations/0026_competitions_foundation.sql --schema prisma/schema.prisma
npx prisma db execute --file supabase/migrations/0027_match_result_competition_link.sql --schema prisma/schema.prisma
```

Alternative : coller le fichier dans le SQL Editor du projet distant. **Windows :** PowerShell, même commande `npx prisma db execute --file ...` (pas `prisma migrate deploy`).

| Fichier | Origine | Rôle |
|---|---|---|
| `0021_live_expiry_player_live.sql` | PR #2 (déjà merged dans la base) | `expires_at`, `player_sessions`, unique PENDING apply |
| `0022_recruitment_status_enums.sql` | PR #2 | ENUM DECLINED / CANCELLED / EXPIRED |
| `0023_expire_live_janitor.sql` | PR #2 | RPC janitor + pg_cron optionnel |
| `0024_apply_live_match_rls.sql` | PR #2 | CHECK LIVE + trigger apply + RLS manager |
| `0025_safety_notifications.sql` | PR #2 | `user_blocks` / `user_reports` / `notifications` + RPC |
| **`0026_competitions_foundation.sql`** | **PR #9** | **`competitions` + `competition_clubs` (unique paire).** |
| **`0027_match_result_competition_link.sql`** | **PR #14** | **`match_results.opponent_club_id` + `competition_id` (nullable FKs). CHECK adverse ≠ club. Trigger : si compétition, les deux clubs sont dans `competition_clubs`. `finalize_match` étendu. Pas de table standings.** |
| **`0028_club_conversation.sql`** | **cette branche** | **Get-or-create conversation `CLUB` (RPC `start_club_conversation`) + sync `club_members` → `conversation_members`. Pas de nouvelle table / pas de 2e chat.** |

**0026 est obligatoire en prod** dès que le code #9+ tourne. **0027 est obligatoire** dès que le code de finalisation avec club adverse / compétition tourne. Sans 0027 : `finalize-match` envoie `p_opponent_club_id` / `p_competition_id` vers une RPC 0014 qui ne les connaît pas. **0028** (conversation club) : appliquer après 0016–0017 (tables + RLS chat déjà là). L’agent n’a pas `DATABASE_URL` ici — **humain / CoS doit appliquer**.

Pas de migration dédiée pour `MESSAGE_RECEIVED` ni `MATCH_FINALIZED` : `notifications.type` est du texte libre (0025, CHECK `char_length(type) > 0` seulement — pas d’enum PG). **Pas de 0029.**  
PR **#5** : aucune migration (UX / filtres UI seulement).

---

## 5. Edge Functions à déployer

Après le SQL, depuis la racine du repo (projet lié) :

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
| `finalize-match` | true | Check-in → `match_results` (score / outcome serveur / club adverse / compétition optionnelle) + notif in-app `MATCH_FINALIZED` après RPC — **redéployer après 0027 et pour cette notif** |
| `expire-live-sessions` | **`verify_jwt = false`** (auth `CRON_SECRET`) | Janitor LIVE ; pg_cron SQL 0023 est l’alternative |
| `create-competition` / `register-competition-club` | true | Fondation #9 |
| `notify-message-received` | true | Notif in-app DM (#10) |
| `start-club-conversation` | true | Get-or-create conversation CLUB (0028) |

Sans `notify-message-received` : le message s’insère quand même (INSERT client + RLS) ; **pas** de ligne `notifications` `MESSAGE_RECEIVED`.  
Sans **redéploiement `finalize-match`** (cette notif) : le résultat s’écrit quand même ; **pas** de ligne `notifications` `MATCH_FINALIZED`. Échec notify ≠ rollback du `match_results` (comme le DM).  
Sans `create-competition` / `register-competition-club` : pas de création / inscription compétition.  
Sans `launch-match-checkin` / `finalize-match` : la feuille `/match` affiche le check-in, mais lancer / enregistrer un résultat échoue (Edge absente).  
Sans **0027 + redéploiement `finalize-match`** : le club adverse / la compétition ne sont pas persistés ; le classement compétition reste vide (honnête).  
`expire-live-sessions` : si pg_cron 0023 est actif, le SQL janitor tourne déjà ; l’Edge reste l’invoke HTTP documenté.

Autres Edge déjà dans le README (`smart-match`, `start-direct-conversation`, `create-group`, `set-group-member-role`, `link-ea-club`, …) : les redéployer si le distant n’a pas la version de cette pile. Toutes les fonctions invocables par l’app sont maintenant déclarées dans `supabase/config.toml` (`verify_jwt = true`, sauf crons / webhook).

---

## 6. QA cloud — tip #14 (PR #5 IN)

### 6.1 P0 stabilize (25 août 2026)

Relance **complète** sur `cursor/qa-autonomous-stack-5884` (`61f34a3` + commits P0). Aucun échec. Moteurs LIVE / matching / apply / invite **non retouchés**. Ligues ranking **non restauré**. Passer Pro **toujours désactivé**. Onglets inchangés : Joueur LIVE \| Activité \| Profil · Club LIVE \| Recrutement \| Club.

| Commande | Résultat |
|---|---|
| `npm run typecheck` | **PASS** |
| `npm run test:live` | **PASS** (14) |
| `npm run test:live-match` | **PASS** (15) |
| `npm run test:live-filters` | **PASS** (6) |
| `npm run test:recruitment` | **PASS** (5) |
| `npm run test:safety` | **PASS** (9) |
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

Audit tip vs `social-ea-foundations-phase-2` (`c0f88ea`, merge-base = tip fondations) : **20 commits** ahead, **0** behind. Pas de merge GitHub vers la base.

Travail incomplet **réel** (pas des faux positifs) :

| Item | Verdict |
|---|---|
| TODO/FIXME code | Aucun TODO produit dans `app/` / `lib/` / `components/`. Placeholders EAS Apple dans `eas.json` (humain). |
| Imports cassés | **0** (scan `@/` + relatifs). |
| Routes « mortes » | `/dashboard` = shim Mode Club ; `/find-club` = ClubMatchmaking ; `/match-sheet` = ClubHome lecture ; `/player-search` = invite-to-slot. Deep links, pas des CTA d’onglets. |
| CTA onglets verrouillés | Déjà câblées (PR CTA) ou désactivées FR (`proPurchaseCta`, slot vide sans handler). Relance : pas de nouvelle CTA morte. |
| Edge deploy docs | **Trou réel** avant P0 : `launch-match-checkin` / `finalize-match` / départs absents de la liste §5 et de `config.toml`. **Corrigé** (déclaration JWT + liste). L’agent **ne déploie pas**. |

### 6.2 P0 Realtime (post-merges #5–#13) — 24 août 2026

**Verdict : déjà correct.** Pas de second `.channel(topic)` sans Map ref-comptée. Fix `7046a8f` intact. Matching / TTL / RLS / apply inchangés.

| Topic | Table | Acquire | Montages qui partagent |
|---|---|---|---|
| `live-feed` | `club_sessions` | `useLiveSessions` | LIVE joueur, FindClubPanel, SmartMatchBanner, deep link `/clubs` |
| `live-players` | `player_sessions` | `useLivePlayers` | LIVE joueur, Recrutement club |
| `my-player-session-${userId}` | `player_sessions` (filtre `user_id`) | `useMyPlayerSession` | PlayerLivePanel — **autre nom** que `live-players` |
| `notifications-${userId}` | `notifications` | `useNotifications` | `_layout` SafetyRealtimeBridge, badge tabs, Activité, Recrutement, `/notifications` |
| `messages-${conversationId}` | `messages` | `useMessages` | `/conversation/[id]` seulement. `useConversations` : **pas** de Realtime |

Crash visé : `supabase.channel(topic)` réutilise l’instance ; un 2ᵉ `.on()` après `.subscribe()` plante. Un canal réel par topic, listeners en Set.

### 6.3 Session → match → résultat → compétition (0027)

Le moteur **existe** et le **lien compétition** est désormais dans le schéma (à appliquer en prod : 0027).

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

Autres trous hors moteurs LIVE (volontaires, pas des régressions de ce tip) :

- Conversation type **CLUB** : schéma prêt, **non provisionnée**.
- Passer Pro : `FEATURE_REVENUECAT` off → CTA désactivée FR. Pas de paiement fictif.
- 0026 + 0027 + Edge §5 : à coller / déployer **par un humain / CoS** ; sans ça création compétition, notif DM, et lien résultat cassés en prod.
- README « Expo Go » encore présent (démarrage historique) — **ne pas** l’utiliser (Dev Client).

---

## 7. Ce que le fondateur doit tester sur iPhone

**EAS Dev Client uniquement** (`eas build --profile development`). Pas Expo Go (modules natifs : notifications, RevenueCat). Pas de simulateur cloud ici.

Compte réel (onboarding terminé) + second compte pour DM / block / apply.

### LIVE (base #2 + UX #5 + #7)

- Joueur **OFF** : carte compacte « Tu veux jouer maintenant ? » → PASSER LIVE → **sheet** (poste/plateforme profil + durée obligatoire, note optionnelle). Pas de formulaire géant.
- Joueur **ON** : carte statut compacte (poste, plateforme, countdown, Modifier / Quitter le LIVE). Expire → retour OFF.
- Trouver un club : cartes opportunité (sessions LIVE réelles), filtres compacts `[Poste ▾] [Plateforme ▾] [Niveau ▾]` + Filtres (langue). Compteur honnête. Empty : **Élargir la recherche** (modèle existant, aucun club inventé). Smart match : motifs déterministes, **pas de %**.
- Club (OWNER/MANAGER) : carte compacte OFF/ON + sheet postes/durée. Postes **toujours requis**. Mapping session : recrutement LIVE (`is_live` + TTL) **distinct** du match lancé (check-in).

### Profils (#6)

- Onglet Profil : ClubPro Card = username, plateforme, postes, plan. Badge EA = `USERNAME_EQUALITY` ou `NONE`, jamais « verified player id ».
- **OVR CPC** labellisé (formule produit). Stats EA seulement si identité `USERNAME_EQUALITY` **et** au moins un chiffre stocké.
- Onglet Club : nom, niveau, plateforme **du owner** (pas de colonne `clubs.platform`), LIVE réel, effectif `club_members`.

### Sessions / effectif (#7)

- Recrutement LIVE et « match lancé » (check-in sans `match_results`) peuvent coexister — pas d’enum OPEN/FULL.
- Feuille `/match` : roster réel, slot vide → recherche → `invite-to-slot`. Check-in via `launch-match-checkin`. Finaliser : scores + **club adverse CPC réel** (recherche, pas un nom libre) + compétition **optionnelle** (OPEN où les deux clubs sont inscrits). Outcome serveur.

### Social (#8)

- Depuis un profil : vrai DM (`start-direct-conversation`) → `/conversation/[id]`. Realtime, pas de pull-to-refresh obligatoire.
- Joueur bloqué : pas de DM, copy « Tu ne peux pas envoyer de message à ce joueur (blocage). »
- Groupes : liste + détail. Pas de 4e onglet. Conversation type **CLUB** : bouton **Conversation du club** (44 pt) sur l’onglet Club, get-or-create `start-club-conversation` → `/conversation/[id]`. Exige **0028** + Edge déployée.

### Compétitions (#9 + 0027) — exige 0026 + 0027 + Edge `finalize-match` redéployée

- Créer une compétition (DRAFT ou OPEN), la voir dans la liste.
- OWNER/MANAGER : inscrire un club géré sur une OPEN. Doublon → **409**, pas une 2ᵉ ligne.
- Classement **seulement** s’il existe au moins un `match_results` avec `competition_id` **et** `opponent_club_id`. Sinon copy honnête, **pas** de rows 0-0-0, **pas** de `season_stats`.

### Notifications (#10 + #11 + MATCH_FINALIZED)

- Compte A envoie un **vrai** DM DIRECT à B → B reçoit une notif in-app « Nouveau message » / « {pseudo} t'a écrit. » Tap → la conversation. Pas de notif pour GROUP/CLUB. Échec notify ≠ rollback du message.
- Activité / `/notifications` : **Tout marquer lu** (44 pt) → badge Activité à **0**. Déjà-lues inchangées.
- **Résultat réel** (`finalize-match` après RPC) : notif `MATCH_FINALIZED` « Résultat de match » / « {club} 3 — 1 {adverse}. » aux membres des deux clubs **sauf le recorder**. Tap → `/match` (Mode Club) ou `/competitions` si `competition_id`. Realtime = canal `notifications` existant. Échec notify ≠ rollback du résultat.

### Édition profil (#12)

- **Modifier mon identité Pro Clubs** sur son Profil → `/edit-profile`.
- Username / plateforme / postes / style / langues / dispo. La ClubPro Card se met à jour.
- Impossible d’envoyer fiabilité, stats EA, `ea_identity_kind`, plan, OVR.

### Édition club (#13)

- OWNER : **Modifier l'identité du club** sur l’onglet Club → `/edit-club` (nom, niveau, langues, description, vocal).
- MANAGER : bouton masqué ; l’écran refuse (RLS `clubs_update_owner`). Pas de colonne `clubs.platform`. Pas d’édition `owner_id` / formation / `ea_club_id`.

### Safety (0025 + Edge block/report)

- Bloquer B → B disparaît du LIVE / matching / messages (bidirectionnel). Débloquer = seulement **mes** blocs.
- Signaler : motif du formulaire, report **OPEN** visible pour le reporter.

### Hors scope à ne pas « tester comme livré »

- Expo Go, CPCP, stats EA inventées, conversation CLUB, classement Ligues (`season_stats`).

---

## 8. EAS iOS / Android — déjà configuré vs humain

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
| Dossiers natifs | **aucun** `ios/` ni `android/` (workflow managed) |
| Gitignore credentials | `.eas/`, `*.p8`, `*.p12`, `*.jks`, `*.key`, `*.mobileprovision` |

Scripts npm : `build:dev` → `eas build --profile development` ; `build:preview` ; `build:prod` ; `submit:ios` / `submit:android`.

### Humain (compte Apple / Expo / Play — pas un agent)

- **`eas login`** sur le compte Expo owner `k64selim` (ou membre du projet `67b7875c-ab0e-4d3d-ab1e-43a4a164d127`). `eas init` n’est plus nécessaire : le `projectId` est déjà dans `app.json`.
- **Apple Developer Program** + équipe réelle. `eas.json` → `submit.production.ios` est encore des **placeholders** : `appleId` `TON_APPLE_ID@exemple.com`, `ascAppId` `TODO_APP_STORE_CONNECT_APP_ID`, `appleTeamId` `TODO_APPLE_TEAM_ID`.
- **Credentials iOS** (certificats / profils) : gérés par EAS après login, **pas** dans git.
- **Android Play** : `serviceAccountKeyPath` pointe vers `./google-service-account.json` — **fichier absent du repo** (correct). Ne pas le committer. Track `internal` seulement.
- **Premier Dev Client** : `eas build --profile development` (iOS et/ou Android) **par un humain**, device réel, puis `npx expo start --dev-client`. Pas Expo Go (notifications, RevenueCat).
- **Store** : submit **non prêt** (placeholders Apple + JSON Play manquant). Ne pas `eas submit`, ne pas publier App Store / Play.
