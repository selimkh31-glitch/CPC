# Pile autonome CPC — PR #5 à #13

**Produit :** ClubPro Connect = matchmaking **EA SPORTS FC 27 Pro Clubs** uniquement. Joueur = profil virtuel Pro Clubs. Club = équipe virtuelle Pro Clubs. Pas de football IRL, pas de stats EA inventées, pas d’Expo Go.

**Date QA :** 24 août 2026  
**Tip de la pile :** `cursor/club-edit-identity-fb68` (`b5a9d49`, PR **#13**)  
**Base d’intégration :** `social-ea-foundations-phase-2` (contient déjà PR **#2** merged — P0/P1 LIVE + safety/notifications — et PR **#3** merged — retab IA).  
**Ce document :** ordre de merge, SQL prod, Edge à déployer, checklist iPhone. L’agent n’applique **pas** les migrations et ne merge **pas** les PR.

Ne pas force-push. Ne pas supprimer les tags `stable-pre-social-phase` / `stable-social-foundations`.

---

## 1. Graphe réel (bases GitHub)

```
social-ea-foundations-phase-2
 ├── PR #5  cursor/player-live-ux-overhaul-8a6e     LIVE UX compact     SIBLING — absent du tip #13
 ├── PR #4  (fix manager feuille / canaux)          hors pile #5–#13
 └── PR #6  cursor/player-club-profile-726b         profils
      └── PR #7  cursor/sessions-teams-0f8a         sessions / effectif
           └── PR #8  cursor/social-chat-groups-89d0  chat + groupes
                └── PR #9  cursor/competitions-foundation-08b2  compétitions + 0026
                     └── PR #10 cursor/dm-message-received-notify-2717  notif DM
                          └── PR #11 cursor/notify-mark-all-read-b782  tout marquer lu
                               └── PR #12 cursor/profile-edit-identity-c408  édition profil
                                    └── PR #13 cursor/club-edit-identity-fb68  édition club  ← tip
```

LIVE déjà dans le tip = PR **#2** (expiry, LIVE joueur/club, matching, apply) + PR **#3** (onglets) + PR **#7** (TTL vs feuille de match). Ce n’est **pas** la refonte UX compacte de la PR **#5** (`test:live-filters` n’existe pas sur ce tip).

---

## 2. Ordre des PR #5–#13

| Ordre | PR | Branche | Base GitHub | Dans le tip #13 ? | Rôle |
|---|---|---|---|---|---|
| — | **#5** | `cursor/player-live-ux-overhaul-8a6e` | `social-ea-foundations-phase-2` | **Non** (sœur de #6) | UX LIVE compacte, sans fake scores |
| 1 | **#6** | `cursor/player-club-profile-726b` | `social-ea-foundations-phase-2` | Oui | Profil joueur + profil club (données réelles) |
| 2 | **#7** | `cursor/sessions-teams-0f8a` | branche #6 | Oui | LIVE TTL vs feuille de match, roster réel |
| 3 | **#8** | `cursor/social-chat-groups-89d0` | branche #7 | Oui | DM + groupes sur le stack chat existant |
| 4 | **#9** | `cursor/competitions-foundation-08b2` | branche #8 | Oui | Compétitions virtuelles (tables + Edge) |
| 5 | **#10** | `cursor/dm-message-received-notify-2717` | branche #9 | Oui | Notif in-app `MESSAGE_RECEIVED` sur DM réel |
| 6 | **#11** | `cursor/notify-mark-all-read-b782` | branche #10 | Oui | Tout marquer lu |
| 7 | **#12** | `cursor/profile-edit-identity-c408` | branche #11 | Oui | Éditer son identité Pro Clubs |
| 8 | **#13** | `cursor/club-edit-identity-fb68` | branche #12 | Oui (tip) | Éditer l’identité de son club (OWNER) |

---

## 3. Ce qu’il faut merger, dans l’ordre

**Ne pas merger les PR en parallèle.** Chaque PR #7–#13 a pour base le **head** de la précédente.

### Pile du tip (à poser sur `social-ea-foundations-phase-2`)

1. Merger **#6** dans `social-ea-foundations-phase-2`
2. Puis **#7** (rebaser / retarget la base si GitHub ne l’a pas avancée)
3. Puis **#8**
4. Puis **#9**
5. Puis **#10**
6. Puis **#11**
7. Puis **#12**
8. Puis **#13**

**Équivalent :** le tip `cursor/club-edit-identity-fb68` contient déjà les commits #6–#13. Un seul merge de ce tip dans `social-ea-foundations-phase-2` pose toute la pile. Ne pas merger #6–#12 ensuite (doublon).

### PR #5 (LIVE UX compacte)

**Ne pas** la merger dans `social-ea-foundations-phase-2` en même temps que #6 : même base, divergente, hors du tip. Si le fondateur la veut : rebase de `cursor/player-live-ux-overhaul-8a6e` **sur le tip #13**, PR dédiée, après la pile.

Hors séquence : PR **#1** (env cloud), PR **#4** (fix manager). Ne pas les glisser dans cette pile.

---

## 4. Migrations prod (Option B)

Source SQL = `supabase/migrations/`. Miroir Prisma dans `schema.prisma` seulement — **ne pas** `prisma migrate deploy` pour 0021–0026 (double-apply).

L’agent **n’applique pas** le SQL en production. Le fondateur colle dans le SQL Editor du projet distant, **dans l’ordre**, après 0002–0020 déjà en place :

| Fichier | Origine | Rôle |
|---|---|---|
| `0021_live_expiry_player_live.sql` | PR #2 (déjà merged dans la base) | `expires_at`, `player_sessions`, unique PENDING apply |
| `0022_recruitment_status_enums.sql` | PR #2 | ENUM DECLINED / CANCELLED / EXPIRED |
| `0023_expire_live_janitor.sql` | PR #2 | RPC janitor + pg_cron optionnel |
| `0024_apply_live_match_rls.sql` | PR #2 | CHECK LIVE + trigger apply + RLS manager |
| `0025_safety_notifications.sql` | PR #2 | `user_blocks` / `user_reports` / `notifications` + RPC |
| **`0026_competitions_foundation.sql`** | **PR #9** | **`competitions` + `competition_clubs` (unique paire). Pas de standings. Pas d’ALTER `match_results`.** |

**0026 est obligatoire en prod** dès que le code #9+ tourne. Sans 0026 : création / liste / inscription compétition cassées. Appliquer **après** 0025.

Pas de migration 0027 pour `MESSAGE_RECEIVED` : `notifications.type` est du texte libre (0025).

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
  respond-departure \
  invite-to-club \
  invite-to-slot \
  expire-live-sessions \
  create-competition \
  register-competition-club \
  notify-message-received
```

| Fonction | JWT gateway | Pourquoi |
|---|---|---|
| `block-user` / `unblock-user` / `report-user` | `verify_jwt = true` | Safety 0025 |
| `apply` | true | Candidature LIVE |
| `respond-application` / `respond-invitation` / `respond-transition-invitation` / `respond-departure` | true (si déclaré) | Réponses recrutement / départ |
| `invite-to-club` / `invite-to-slot` | true | Invitations |
| `expire-live-sessions` | **`verify_jwt = false`** (auth `CRON_SECRET`) | Janitor LIVE ; pg_cron SQL 0023 est l’alternative |
| `create-competition` / `register-competition-club` | true | Fondation #9 |
| `notify-message-received` | true | Notif in-app DM (#10) |

Sans `notify-message-received` : le message s’insère quand même (INSERT client + RLS) ; **pas** de ligne `notifications` `MESSAGE_RECEIVED`.  
Sans `create-competition` / `register-competition-club` : pas de création / inscription compétition.  
`expire-live-sessions` : si pg_cron 0023 est actif, le SQL janitor tourne déjà ; l’Edge reste l’invoke HTTP documenté.

Autres Edge déjà dans le README (`smart-match`, `start-direct-conversation`, `create-group`, `link-ea-club`, …) : les redéployer si le distant n’a pas la version de cette pile.

---

## 6. QA cloud (24 août 2026) — tip #13

Aucune régression code sur ce passage. `test:live-filters` **absent** (PR #5 hors tip).

| Commande | Résultat |
|---|---|
| `npm run typecheck` | **PASS** |
| `npm run test:live` | **PASS** (14) |
| `npm run test:live-filters` | **N/A** — script inexistant |
| `npm run test:live-match` | **PASS** (15) |
| `npm run test:recruitment` | **PASS** (5) |
| `npm run test:safety` | **PASS** (8) |
| `npm run test:player-card` | **PASS** (9) |
| `npm run test:club-profile` | **PASS** (8) |
| `npm run test:session-state` | **PASS** (9) |
| `npm run test:social` | **PASS** (5) |
| `npm run test:competitions` | **PASS** (9) |
| `npm run test:ovr` | **PASS** (9) |
| `npm run test:profile-identity` | **PASS** (7) |
| `npm run test:notification-read` | **PASS** (3) |
| `npm run test:club-identity` | **PASS** (7) — tip #13 |

---

## 7. Ce que le fondateur doit tester sur iPhone

**EAS Dev Client uniquement** (`eas build --profile development`). Pas Expo Go (modules natifs : notifications, RevenueCat). Pas de simulateur cloud ici.

Compte réel (onboarding terminé) + second compte pour DM / block / apply.

### LIVE (base #2 + #7, pas l’UX #5)

- Joueur : Passer LIVE → countdown TTL → expire tout seul → OFF. Modifier la durée. Quitter le LIVE.
- Trouver un club : uniquement des sessions LIVE réelles (`is_live` + `expires_at` futur). Postuler (`apply`). Empty state honnête si 0 LIVE — aucun club inventé.
- Club (OWNER/MANAGER) : Passer le club LIVE (postes requis) → TTL → OFF.

### Profils (#6)

- Onglet Profil : ClubPro Card = username, plateforme, postes, plan. Badge EA = `USERNAME_EQUALITY` ou `NONE`, jamais « verified player id ».
- **OVR CPC** labellisé (formule produit). Stats EA seulement si identité `USERNAME_EQUALITY` **et** au moins un chiffre stocké.
- Onglet Club : nom, niveau, plateforme **du owner** (pas de colonne `clubs.platform`), LIVE réel, effectif `club_members`.

### Sessions / effectif (#7)

- Recrutement LIVE et « match lancé » (check-in sans `match_results`) peuvent coexister — pas d’enum OPEN/FULL.
- Feuille `/match` : roster réel, slot vide → recherche → `invite-to-slot`. Check-in via `launch-match-checkin`.

### Social (#8)

- Depuis un profil : vrai DM (`start-direct-conversation`) → `/conversation/[id]`. Realtime, pas de pull-to-refresh obligatoire.
- Joueur bloqué : pas de DM, copy « Tu ne peux pas envoyer de message à ce joueur (blocage). »
- Groupes : liste + détail. Pas de 4e onglet. Conversation type **CLUB** toujours non provisionnée.

### Compétitions (#9) — exige 0026 + Edge

- Créer une compétition (DRAFT ou OPEN), la voir dans la liste.
- OWNER/MANAGER : inscrire un club géré sur une OPEN. Doublon → **409**, pas une 2ᵉ ligne.
- Pas de classement généré (volontaire : `match_results` n’a pas `competition_id`).

### Notifications (#10 + #11)

- Compte A envoie un **vrai** DM DIRECT à B → B reçoit une notif in-app « Nouveau message » / « {pseudo} t'a écrit. » Tap → la conversation. Pas de notif pour GROUP/CLUB. Échec notify ≠ rollback du message.
- Activité / `/notifications` : **Tout marquer lu** (44 pt) → badge Activité à **0**. Déjà-lues inchangées.

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

- Expo Go, CPCP, stats EA inventées, brackets / standings compétition, conversation CLUB, PR #5 UX compacte (hors tip).
