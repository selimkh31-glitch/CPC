# ClubPro Connect — Audit EA SPORTS FC 27 Pro Clubs

**Date :** 24 août 2026  
**Branche de référence :** `social-ea-foundations-phase-2` (`9e6ae11`)  
**Produit :** CPC est exclusivement le matchmaking pour **EA SPORTS FC 27 Pro Clubs**.  
Joueur = utilisateur virtuel Pro Clubs. Club = équipe/communauté virtuelle Pro Clubs. Recrutement = remplir un roster Pro Clubs. **Pas** du football IRL.

Ce document est **factuel** : chaque grade s’appuie sur des fichiers lus. Aucune note n’est gonflée.  
Échelle : `ABSENT` | `PROTOTYPE` | `PARTIAL` | `FUNCTIONAL` | `SOLID` | `PRODUCTION READY`.

---

## 1. Matrice

| FEATURE | VISION | CURRENT | QUALITY | GAP | DEPENDENCIES | PRIORITY |
|---|---|---|---|---|---|---|
| **Auth** | Compte email, session persistante, onboarding profil Pro Clubs, garde d’écrans | Email/password via Supabase Auth (`app/(auth)/login.tsx`), upsert profil (`app/onboarding.tsx`), `AuthProvider` + `Stack.Protected` (`app/_layout.tsx`), callback `clubproconnect://auth/callback`. Pas d’OAuth, pas d’écran reset password. | **FUNCTIONAL** | Pas de recovery UI ; confirmation email dépend du deep link Dev Client (déjà durci). Pas de tests Auth. | Supabase Auth, SecureStore | P0 (cœur signup/profil — **existant, à conserver**) |
| **Player** | Identité Pro Clubs (username, plateforme, postes, style, langues, dispo) | Colonnes `users` (`prisma/schema.prisma`). Onboarding 6 étapes. Profil + ClubPro Card + reviews. **Pas de LIVE joueur.** | **FUNCTIONAL** | LIVE joueur absent ; pas d’édition de profil hors onboarding (re-upsert seulement si pas de ligne). | Auth, RLS `users_*` | P0 (LIVE joueur) / P2 (édition profil) |
| **Club** | Club Pro Clubs : création, effectif, formation, voice, owner/manager | CRUD club, trigger `on_club_created` (OWNER atomique), formation + slots, members, voice link, Mode Club. | **SOLID** | Sélecteur multi-club dashboard = premier club seulement (README). Pas de conversation CLUB provisionnée. | Auth, RLS clubs/members | P1 |
| **ClubPro Card** | Carte virale type FUT : OVR **CPC**, rareté, stats EA **seulement si vérifiées** | `ClubProCard` + `PlayerCard`/`buildPlayerCardData`. OVR = formule produit (`lib/ovr.ts`, testée). Stats affichées en `—` si absentes (ClubProCard) ; PlayerCard hero masque les stats si `eaStats` null. | **FUNCTIONAL** | OVR présenté comme un gros chiffre non labellisé « CPC » (risque de le croire EA). Double composant Card. Share avec emoji football. | OVR, Reliability, EA cache | P0 (copy honnête) |
| **EA data** | Stats Pro Clubs vérifiées contre l’API, identité stable, états de sync | Client défensif `supabase/functions/_shared/ea.ts` vers `proclubs.ea.com/api/fc` (non officiel). `link-ea-club` + cron `ea-sync`. Adapter `EAProvider` : 3 méthodes / 9, plusieurs `NotImplementedError`. Matrice : `docs/ea-capability-matrix.md`. | **PARTIAL** | Matching joueur = égalité `username == playername` (casse ignorée). Pas de `sync_status`. Endpoints club/info, members, career, leaderboard, playoffs = **E / NOT AVAILABLE**. | Feature flag `FEATURE_EA_STATS`, réseau EA | P1 (identité) / P2 (sync_status) |
| **OVR** | Score produit CPC transparent, jamais vendu comme note EA | `computeOvr` : fiabilité 70 % + perf EA 30 % si `matchesPlayed > 0`, clamp 40–99. Tests `scripts/test-ovr.ts`. | **FUNCTIONAL** | Plancher visuel élevé même sans stats EA (nouveau joueur ~45). UI ne dit pas « OVR CPC ». | Reliability, `verified_stats` | P0 (labellisation) |
| **Reliability** | Trust Engine : reviews + streak + bonus EA | `supabase/functions/_shared/reliability.ts` (source unique, réexport `lib/reliability.ts`). Recalc via `submit-review`. Tests `scripts/test-reliability.ts`. | **SOLID** | Dépend de reviews pairs (volume faible au début). Strikes départ (Phase 5) séparés du score. | Reviews, Edge `submit-review` | P2 |
| **Discovery** | Ouvrir l’app → voir qui est LIVE (clubs **et** joueurs) maintenant | Live Feed = `club_sessions.is_live = true` uniquement (`useLiveSessions`, `app/(player)/(tabs)/index.tsx`). Filtres poste/niveau/langue **côté client**. Pas de filtre plateforme (platform est sur `users`, pas clubs). | **PARTIAL** | Pas de joueurs LIVE. Sessions LIVE **sans expiry**. Filtres non indexés serveur. | LIVE club/player, Realtime | **P0** |
| **Search** | Trouver un club / un joueur Pro Clubs sans IA | `useClubSearch`, `usePlayerSearch` (poste + exclusion engagés), `useInvitableClubPlayers` (pseudo). Tests M2 `scripts/test-m2-player-search.ts`. | **FUNCTIONAL** | Recherche joueur LIVE absente. Pas de full-text. | Player, Club, engagement | P1 |
| **LIVE player** | Joueur se déclare disponible **maintenant**, avec expiry, visible au recrutement | **Aucune table, aucun écran, aucun hook.** `usePresence` = présence Realtime (en ligne dans l’app), **pas** un LIVE recrutement. | **ABSENT** | Tout le vertical slice. | Auth, RLS, Discovery, Invitations | **P0** |
| **LIVE club** | Club recrute **maintenant** (postes manquants), avec expiry, 1 LIVE / club | `club_sessions.is_live`, unique index `club_sessions_one_live_per_club` (`0005_live_workflow.sql`), toggle `LiveSessionPanel`, Realtime feed. **Pas de `expires_at`.** Un club LIVE le reste jusqu’à toggle manuel. | **PARTIAL** | Expiry absente (hypothèse **vérifiée**). `apply` vérifie `is_live` mais pas une date. Confusion LIVE recrutement vs écran match « LIVE ». | Club, RLS `club_sessions_write_manager` | **P0** |
| **Matching** | Reco déterministe poste/langue/niveau ; IA optionnelle | `smart-match` : fallback déterministe (`_shared/ai.ts` `fallbackSmartMatch`) + IA si `AI_API_KEY`. EA player match = username equality (**vérifié** dans `ea.ts` L97–99). | **PARTIAL** | IA clés placeholder (`sk-placeholder` dans `_shared/ai.ts`). Smart Match ignore expiry LIVE. Matching EA fragile par construction. | LIVE club, profil, EA | P1 (déterministe déjà là) |
| **Recruitment** | Apply + invite + états clairs + idempotence | Apply Edge (`apply`) : gating Free 3/jour, anti-membre, anti-doublon PENDING **applicatif**. Accept atomique `accept_application()`. Invite club/slot + unique PENDING invitations (`0015`). Withdraw PENDING. **Pas d’index unique PENDING applications.** | **FUNCTIONAL** | Course apply possible (2 PENDING). Pas d’expiry de candidature. Compteur Free incrémenté **avant** insert (échec = quota brûlé). | LIVE, RLS, Edge, invitations | **P0** (idempotence) |
| **Sessions** | Session recrutement ≠ match Pro Clubs lancé | `club_sessions` = recrutement LIVE. `match_checkins` = lancement match (Phase 5). UI Match Center mélange les deux (badge LIVE recrutement sur l’écran match). | **FUNCTIONAL** | Vocabulaire « session » / « LIVE » ambigu. Check-in exige une session LIVE (couplage volontaire). | LIVE club, Match Result | P2 |
| **Teams** | Roster 11 + banc, formation, slots | `lib/formations.ts`, `slot_assignments`, feuille de match, check-in titulaire/banc. | **FUNCTIONAL** | Changement de formation wipe les slots (documenté). Conversation club non branchée. | Club, members | P2 |
| **Social** | Socle chat + groupes distincts du club compétitif | Tables + RLS 0016–0020, UI conversations/groups, Edge create-group / start-direct / roles. Commit `9e6ae11` durcit RLS. | **FUNCTIONAL** | Conversation type CLUB : schéma prêt, **non provisionnée**. Pas de badge unread (volontaire). | Auth, RLS | P2 |
| **Groups** | Groupes sociaux PUBLIC/PRIVATE, rôles, chat | UI complète (`app/groups.tsx`, `group/[id].tsx`), trigger conversation GROUP, `create_group` RPC. | **FUNCTIONAL** | Pas de découverte/search de groupes publics poussée. | Chat, RLS | P2 |
| **Chat** | DIRECT / GROUP / CLUB, realtime, pagination, soft-delete | Insert client + RLS `sender_id` JWT. Pagination 30. Realtime messages. | **FUNCTIONAL** | Pas de media, pas de push à chaque message, CLUB non branché. | Social RLS, Realtime | P2 |
| **Notifications** | Push recrutement + in-app | `lib/notifications.ts` enregistre `push_token`. Edge apply/respond/departure envoient Expo Push. Token révoqué en SELECT client. | **PARTIAL** | Pas de centre de notifs in-app. Inopérant simulateur / sans EAS Dev Client. `app.json` duplique `remote-notification`. | EAS Dev Client, device réel | P1 |
| **Competitions** | Ligues / tournois Pro Clubs | **Une** saison globale `seasons` + `season_stats` + `season-ranking`. Ligues multiples / tournois = **doc seulement** (`docs/competitions-phase2.md`). | **PARTIAL** (saison globale) / **ABSENT** (tournois, ligues multi) | Hors P0 (choix produit explicite). | Match results, EA | P3 |
| **Rankings** | Classements CPC vs EA séparés | `season_stats.points/division` CPC. EA leaderboard officiel **non implémenté**. UI Ligues : buteurs/passeurs/CS/MVP. | **FUNCTIONAL** | Points CPC peuvent incorporer stats EA via sync (rapprochement username). Pas de `ranking_source`. | season-ranking, ea-sync | P2 |
| **Reputation** | Fiabilité + badges + reviews visibles | Reviews publiques, streak, badges JSON, Scout Report (Pro, fallback déterministe). | **FUNCTIONAL** | Scout Report invente des forces (« Finition » / « Vision ») sans assez de data. | Reliability, AI flag | P2 |
| **Safety (block/report)** | Bloquer / signaler un utilisateur | **Aucune table `blocks`/`reports`.** Modération **texte** seulement (`moderate` + blocklist basique + IA). | **PROTOTYPE** (modération texte) / **ABSENT** (block/report) | Pas de block, pas de report user, blocklist FR courte. | Moderation Edge | P1 |
| **RLS** | Least privilege, mutations sensibles en Edge | RLS 0002 + match sheet + engagement + social. Grants 0006/0008. `push_token` révoqué. RPCs `service_role` only. Recursion social fix 0019. | **SOLID** | Pas de tests automatisés des policies. Toggle LIVE est un UPDATE client (OK si policy manager). Applications INSERT client possible (défense en profondeur vs Edge). | Postgres, Auth | **P0** (étendre pour player LIVE + unique apply) |
| **Realtime** | Feed LIVE, candidatures, chat, présence | Canaux `club_sessions`, `applications`, messages, departures. Presence globale. Registres anti double-subscribe. | **FUNCTIONAL** | Presence ≠ LIVE. Invitations club **sans** canal realtime (doc dans `useInvitations`). | Supabase Realtime | P1 |
| **iOS** | Dev Client + EAS, pas de dossier natif commité | `app.json` bundle `com.clubproconnect.app`, `expo-dev-client`, EAS `developmentClient: true`. **Aucun dossier `ios/`.** `eas.json` submit : placeholders Apple ID. | **PARTIAL** | Managed workflow + Dev Client (**hypothèse vérifiée**). Submit non prêt. | EAS, Apple Developer | P1 (build) / P3 (store) |
| **Android** | Idem | Package `com.clubproconnect.app`, permissions NOTIFICATIONS. **Aucun dossier `android/`.** Submit : `google-service-account.json` attendu, non audité ici. | **PARTIAL** | Idem iOS. | EAS | P1 / P3 |

---

## 2. Hypothèses — vérification

| Hypothèse | Verdict | Preuve |
|---|---|---|
| Matching EA = égalité username | **VRAI** | `supabase/functions/_shared/ea.ts` L97–99 : « rapprochement par égalité `username == playername EA` » ; clés d’agrégation = `p.name.trim().toLowerCase()`. Confirmé `docs/ea-capability-matrix.md` § Player Identity. |
| LIVE n’expire pas | **VRAI** | `club_sessions` : `is_live` booléen, **pas** de `expires_at` (`prisma/schema.prisma` ClubSession). `expires_at` n’existe que sur `club_departures`. Feed = `.eq("is_live", true)` sans date. |
| Clés RevenueCat / IA = placeholders | **VRAI** | `.env.example` : `appl_placeholder` / `goog_placeholder`. `lib/revenuecat.ts` refuse les clés `*_placeholder`. `_shared/ai.ts` : `apiKey === "sk-placeholder"` → erreur, fallback déterministe. Flag RevenueCat `false` par défaut. |
| Pas de dossiers `ios/` / `android/` (managed Expo + expo-dev-client) | **VRAI** | Glob `ios/**` et `android/**` = 0 fichiers. `package.json` : `expo-dev-client ~57.0.12`. `eas.json` profile `development.developmentClient: true`. |

Tags git `stable-pre-social-phase` et `stable-social-foundations` **présents** — ne pas les supprimer.

---

## 3. BROKEN / MISSING / WEAK / TECH DEBT

### BROKEN (comportement faux ou piège réel)

- **LIVE infini** : un club oublié reste dans le feed indéfiniment ; `apply` accepte tant que `is_live` (pas de TTL).
- **Apply non idempotent en base** : unique PENDING invitations existe (`0015`) ; **applications** n’ont qu’un `maybeSingle()` applicatif → course = 2 PENDING.
- **Quota Free brûlé si insert apply échoue** : `applications_today` est incrémenté **avant** l’INSERT (`apply/index.ts`).
- **OVR / stats** : le gros chiffre OVR n’est pas nommé CPC ; un utilisateur peut le prendre pour une note EA. ClubProCard affiche des blocs Buts/Passes/Matchs même **sans** lien EA (`—` = honnête, mais le layout suggère des stats).
- **Smart Match / Scout** avec `FEATURE_AI=true` et clé absente : fallback OK, mais Scout fallback **invente** des forces (« Finition » vs « Vision de jeu ») — contraire à « no invented stats ».
- `app.json` `UIBackgroundModes` duplique `"remote-notification"`.

### MISSING (P0 soulignés)

- **LIVE joueur** (table + UI + discovery + expiry) — **P0**
- **Expiry LIVE club** — **P0**
- **Index unique applications PENDING** — **P0**
- Block / report utilisateur
- Conversation CLUB provisionnée
- Ligues multiples / tournois (P3, volontaire)
- Reset password, OAuth
- `sync_status` EA (`SYNCED/STALE/FAILED/NEVER_SYNCED`)
- Dossiers natifs iOS/Android (attendu en managed)

### WEAK

- Matching EA par nom (limitation source, pas un bug de code).
- Présence Realtime présentée mentalement comme « en ligne » ≠ recrutement LIVE.
- Live Feed filtres 100 % client ; pas de `platform` sur clubs.
- Push + IAP uniquement Dev Client / device réel.
- `eas.json` submit = TODO placeholders.
- Un seul dashboard club si multi-owner.
- README / login parlent encore « FIFA » / « Pro Clubs » générique, pas **FC 27**.

### TECH DEBT

- Double source migrations : Prisma historique + `supabase/migrations/` devenue source distante (Option B, `0016` header). Les ALTER doivent vivre dans **les deux** (schema Prisma + SQL supabase) sans double-apply distant.
- `0001_init_note.sql` dit encore « Prisma crée les tables » — partiellement obsolète post-Option B.
- `lib/reliability.ts` n’est qu’un re-export ; OVR reste dans `lib/ovr.ts` (Edge n’importe pas OVR aujourd’hui).
- Two cards : `ClubProCard` vs `PlayerCard`.
- README structure `(tabs)/` obsolète (désormais `(player)` / `(club)`).
- Feature AI default `true` alors que la clé est placeholder → tout passe en fallback (OK) mais le flag ment.

---

## 4. Scan copy UI — langage football IRL / hors FC 27

Hors scope : postes Pro Clubs (GK, ST, « Gardien »…) et vocabulaire **jeu** (formation, feuille de match, buts EA) — c’est du FC 27, pas de l’IRL.

| Fichier | Extrait | Problème |
|---|---|---|
| `README.md` L3 | « EA SPORTS FC / **FIFA** Pro Clubs » | FIFA = marque héritée / IRL licensing, pas FC 27. |
| `clubpro-connect-build-prompt.md` L13, L80 | FIFA ; « carte animée type FIFA » | Idem + cadrage IRL/FUT ambigu. |
| `app/(auth)/login.tsx` | « Matchmaking temps réel pour Pro Clubs. » | Pas de millésime FC 27. |
| `app/onboarding.tsx` | « Là où tu joues à FC Pro Clubs. » / « sur le terrain » | Vague ; « terrain » sonne IRL. |
| `components/profile/ClubProCard.tsx` | Share `OVR` + ⚽ | OVR non qualifié CPC ; emoji football IRL. |
| `components/club/LiveMatchScreen.tsx` | « Votre équipe » | OK *si* club Pro Clubs ; à garder dans ce contexte. |
| `app/(player)/(tabs)/leagues.tsx` | « Ligues » | Saison CPC globale, **pas** les ligues EA — risque de confusion (P3, pas P0). |

Ne **pas** traiter comme IRL : Club, joueur, recrutement, roster, Pro Clubs, postes FC.

---

## 5. Stack / runtime (constat)

- Expo SDK **57**, Expo Router, TypeScript, NativeWind, Supabase, Prisma, `expo-dev-client`.
- Tests : `npm run typecheck` + scripts `tsx` (`test:ea-normalize`, `test:ovr`, `test:reliability`, `test:player-card`, `test:m2-player-search`). Pas de Jest/Detox.
- Secrets : `.env.example` ne contient que `EXPO_PUBLIC_*` ; clés serveur documentées comme secrets Edge — **ne pas les committer**.

---

## 6. P0 retenu pour exécution immédiate

Le cœur de boucle bloqué aujourd’hui :

1. **LIVE club + expiry** (plus de LIVE éternel).
2. **LIVE joueur + expiry + discovery**.
3. **Copy honnête FC 27 Pro Clubs** + OVR/stats labellisées CPC vs EA (pas de stats inventées à l’écran).
4. **Idempotence candidatures PENDING** (index unique, comme les invitations).
5. **RLS + migration + tests** du slice, sans mocker la feature.

Hors P0 (volontaire) : compétitions, ligues multi, tournois, block/report, RevenueCat réel, endpoints EA manquants.
