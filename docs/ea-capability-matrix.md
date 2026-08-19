# EA FC Clubs Pro — Matrice de capacité

> Audit factuel de ce qui existe réellement dans le repo pour la donnée EA,
> classé selon la mission "EA FC CLUBS PRO DATA FOUNDATION" (section 6) :
> **A. VERIFIED AGAINST REAL API · B. IMPLEMENTED BUT NOT VERIFIED · C. STUB
> · D. UNKNOWN · E. NOT AVAILABLE**.
>
> Règle absolue respectée ici : aucun endpoint n'est classé A simplement
> parce qu'une fonction existe. "Existe" ≠ "vérifié" ≠ "fiable".

## Légende des colonnes

- **Source** : fichier qui possède la logique réseau réelle.
- **Testé réellement ?** : exécuté contre `proclubs.ea.com` pendant une
  session de développement, avec une vraie réponse observée — pas juste
  "le code compile" ni "unit-testé avec un payload fabriqué à la main".

## Matrice

| Capacité | Source | Endpoint | Statut | Testé réellement ? | Fiabilité | Limitations connues |
|---|---|---|---|---|---|---|
| Rechercher un club par nom | `_shared/ea.ts` (`resolveEaClubId`), exposée aussi via `ea/proClubsAdapter.ts` (`searchClub`) | `/allTimeLeaderboard/search?clubName=` | **A** (logique historique) / **B** (wrapper `searchClub`, normalisation neuve) | Oui pour `resolveEaClubId` (utilisée en prod par `link-ea-club` depuis la Phase 1 du build initial) — **non** pour le wrapper `searchClub` (jamais exécuté depuis sa création) | Moyenne — endpoint communautaire non documenté, réponse déjà observée changer de forme (`clubs` vs tableau racine, cf. le code défensif) | Ne retourne pas systématiquement un `name` exploitable (fallback sur le terme cherché) |
| Récupérer les matchs récents d'un club | `_shared/ea.ts` (`fetchVerifiedClubStats` interne), `ea/proClubsAdapter.ts` (`getClubMatches`) | `/clubs/matches?matchType=leagueMatch\|friendlyMatch` | **A** (logique réseau) / **B** (wrapper normalisé) | Oui pour le fetch brut (utilisé quotidiennement par `ea-sync`, cron actif) — **non** pour `getClubMatches`/`normalizeMatch` | Moyenne-haute — chemin le plus éprouvé du module EA, mais SSL/pannes intermittentes documentées dans le code depuis l'origine | `maxResultCount=10` fixe, pas de pagination ; pas d'id joueur stable (voir Player Identity) |
| Stats agrégées d'un joueur (buts/passes/CS/note) sur un club | `ea/proClubsAdapter.ts` (`getPlayerStats`) + `ea/normalize.ts` (`aggregatePlayerStats`) | dérivé de `/clubs/matches` (pas d'endpoint dédié) | **B** | Non — corrigée cette session (bug réel : indexait par clé au lieu de chercher par valeur, voir historique Git `fix(ea)`), unit-testée (19 cas), jamais exécutée en vrai | Dépend entièrement de la fiabilité du matching par nom (voir Player Identity) | Le matching par nom est approximatif par construction — pas une limitation du code, une limitation de la source |
| Fiche club (`/clubs/info`) | — | non implémenté | **E** | — | — | Endpoint jamais appelé ni observé par ce repo |
| Stats globales d'un club (`/clubs/overallStats`) | — | non implémenté | **E** | — | — | Idem |
| Effectif d'un club (`/members/stats`) | — | non implémenté | **E** | — | — | Idem — un effectif ne peut être qu'inféré des matchs (noms rencontrés), jamais une vraie liste de membres |
| Historique carrière d'un joueur (`/members/career/stats`) | — | non implémenté | **E** | — | — | Idem |
| Classement saison courante (`/currentSeasonLeaderboard`) | — | non implémenté | **E** | — | — | Idem |
| Classement all-time (`/allTimeLeaderboard`, hors `/search`) | — | non implémenté | **E** | — | — | Seule sa variante `/search` est utilisée (résolution de club) |
| Playoffs (`/club/playoffAchievements`) | — | non implémenté | **E** | — | — | Idem |
| FC Community API officielle EA | — | — | **D** | — | Inconnue | Accès conditionné, jamais évalué — voir `provider.ts`, réservé comme `"ea-official"` dans `EAProviderName` sans implémentation |

## Player Identity — limitation structurelle (pas un bug)

**Aucun identifiant joueur EA stable n'est mappable à `users.id`.** Confirmé
en relisant le seul payload réellement consommé (`/clubs/matches`) : la clé
d'objet `players[clubId][playerId]` est un id EA interne (persona id),
jamais exposé nulle part comme identifiant réutilisable par un autre
endpoint. Le seul champ exploitable est `playername` (texte libre, saisi par
le joueur dans EA FC, pas garanti unique ni stable dans le temps).

Conséquence architecturale déjà en place :

```
CPC User (users.id, uuid stable)
      ↕ rapprochement PAR VALEUR, jamais par clé
EA Identity (players[...].playername, texte libre)
      ↕
EA External Identifier (clubId, seul id réellement stable — au niveau CLUB, pas joueur)
```

Le rapprochement `username == playername EA` (comparaison insensible à la
casse) est donc un **fallback explicite et documenté**, jamais traité comme
un identifiant primaire — voir `EAMatch.players` (`ea/types.ts`) et
`aggregatePlayerStats` (`ea/normalize.ts`), tous deux commentés en ce sens
suite au bug corrigé cette session (l'erreur initiale venait justement d'un
commentaire qui laissait croire à tort que ce rapprochement était fiable
"par clé").

## Résilience / cache / sync (mission section 7)

| État prévu par la mission | Implémenté ? | Où |
|---|---|---|
| Retries + timeout | ✅ | `_shared/ea.ts` (`eaGet`, `MAX_RETRIES=2`, backoff exponentiel, `AbortSignal.timeout`) |
| Fallback silencieux si EA down | ✅ | Chaque fonction EA catch + retourne `null`, jamais d'exception propagée au client (`ea-sync`/`link-ea-club` gardent l'ancienne valeur en cache) |
| Feature flag de désactivation | ✅ | `FEATURE_EA_STATS` (env), vérifié en tête de chaque méthode |
| `SYNCED / SYNCING / STALE / FAILED / NEVER_SYNCED` (états explicites) | ❌ | `users.verified_stats` a un `lastSyncedAt` mais aucun champ de statut — un échec de sync est indiscernable d'un "jamais synchronisé" côté UI actuellement |
| Idempotence de la sync | ✅ (implicite) | `ea-sync` fait un `upsert` sur `season_stats` (`onConflict: "season_id,user_id"`) et un `update` sur `users` — rejouer le job ne duplique rien |
| Logs structurés sans secrets | ⚠️ partiel | `console.warn`/`console.error` présents mais non structurés (pas de `request_id`/`operation` en JSON) — acceptable pour le volume actuel, à revoir si le débit augmente |

**Non fait cette session** (nécessiterait de toucher `ea-sync`, en
production, cron actif — hors scope "faible risque") : ajouter une colonne
`sync_status` à `users`/`season_stats` pour que l'UI distingue explicitement
"jamais synchronisé" de "sync échouée, dernière valeur conservée". Proposé
en Phase 2, pas construit.

## Ce qui est réellement fonctionnel aujourd'hui

- `ea-sync` (cron quotidien) et `link-ea-club` : en usage, protection CRON_SECRET/JWT correcte, fallback silencieux correct.
- `EAProvider`/`ProClubsEAProvider` : architecture en place, 3 méthodes sur 9 avec une vraie logique (dont 1 corrigée cette session), unit-testées (26 tests au total entre `test-ea-normalize.ts`).

## Ce qui reste UNVERIFIED

`searchClub`, `getClubMatches`, `getPlayerStats` — jamais exécutés en tant
que méthodes d'`EAProvider` contre l'API réelle (seule la logique réseau
sous-jacente, dans `_shared/ea.ts`, est éprouvée en prod via `ea-sync`/
`link-ea-club`, qui ne passent pas par cet adapter).

## Ce qui est BLOCKED

Implémenter `getClub`, `getClubStats`, `getClubMembers`,
`getPlayerCareerStats`, `getLeaderboard`, `getPlayoffData` — nécessite de
découvrir/valider des endpoints EA réels, non simulable localement, contre
la règle "ne jamais fabriquer un endpoint" (mission section 25). Restent en
`NotImplementedError` volontairement.
