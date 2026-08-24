# ClubPro Connect (mobile)

Application mobile native **iOS + Android** de matchmaking temps réel pour **EA SPORTS FC 27 Pro Clubs**. Identité compétitive vérifiée, Trust Engine, Live Feed, Ligues & Saisons. Une seule base de code cross-platform, dark mode e-sport.

Stack : **React Native + Expo (SDK 57, Expo Router)** · **TypeScript strict** · **NativeWind** · **Supabase** (Auth + Postgres + Realtime + RLS + Edge Functions) · **Prisma** (schéma/outils) · **RevenueCat** (achats in-app) · **EAS Build/Submit**.

---

## Sommaire

- [Démarrage rapide](#démarrage-rapide)
- [Configuration](#configuration)
- [Base de données & RLS](#base-de-données--rls)
- [Supabase Edge Functions](#supabase-edge-functions)
- [Seed data](#seed-data)
- [Lancer l'app (iOS / Android)](#lancer-lapp-ios--android)
- [EAS Build & Submit](#eas-build--submit)
- [Cron jobs](#cron-jobs)
- [Brancher RevenueCat](#brancher-revenuecat)
- [Brancher l'IA](#brancher-lia)
- [Notifications push](#notifications-push)
- [Feature flags](#feature-flags)
- [Structure du projet](#structure-du-projet)
- [Design system](#design-system)
- [Algorithme de fiabilité](#algorithme-de-fiabilité)
- [Limites connues](#limites-connues--mvp)

---

## Démarrage rapide

```bash
npm install
cp .env.example .env      # Expo charge .env automatiquement (EXPO_PUBLIC_*)
npm run prisma:generate
npm run prisma:migrate    # crée les tables dans Supabase
npm run prisma:seed       # peuple 30 users, 10 clubs, sessions live, etc.
npx expo start            # scanne le QR avec Expo Go, ou lance un simulateur
```

## Configuration

### 1. Créer un projet Supabase
1. [supabase.com](https://supabase.com) → New Project.
2. `Project Settings > API` → copie `Project URL` et `anon public key` → `.env` :
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
3. `Project Settings > Database` → connection strings → `DATABASE_URL` (pooled, port 6543) et `DIRECT_URL` (directe, port 5432), utilisées par Prisma (CLI uniquement, jamais lues par l'app).
4. `Authentication > Providers` → Email activé par défaut. Désactive la confirmation email en dev si tu veux tester plus vite (`Authentication > Settings`).
5. `Project Settings > Edge Functions > Secrets` → renseigne les variables **serveur** (jamais dans `.env` mobile) : `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `AI_API_KEY`, `AI_API_BASE_URL`, `AI_MODEL`, `FEATURE_EA_STATS`, `FEATURE_AI`, `REVENUECAT_WEBHOOK_SECRET`.

### 2. Variables d'environnement
Copie `.env.example` → `.env`. Seules les variables préfixées `EXPO_PUBLIC_` sont embarquées dans le bundle client (Metro les inline automatiquement) — tout le reste vit dans les secrets Supabase Edge Functions.

## Base de données & RLS

Le schéma applicatif (`prisma/schema.prisma`, avec `prisma/migrations/20260815000000_init`) est appliqué via Prisma, puis les policies RLS et les triggers via le SQL Editor de Supabase (ou `supabase db push`), **dans cet ordre** :

```bash
npm run prisma:migrate
# puis, dans le SQL Editor de Supabase (ou `supabase db push`), DANS L'ORDRE :
# 1. supabase/migrations/0002_rls_policies.sql
# 2. supabase/migrations/0003_triggers.sql   (dépend des policies ci-dessus)
```

Tous les `id` (sauf `users.id`, toujours l'UID Supabase Auth) utilisent `@default(dbgenerated("gen_random_uuid()"))` — un vrai DEFAULT Postgres — pour que les INSERT faits hors Prisma Client (app mobile via `supabase-js`, Edge Functions) fonctionnent sans fournir `id`.

Sécurité en deux couches :
- **Mutations simples** (créer un club, toggle live, éditer son profil, lecture du feed) : l'app mobile appelle **directement** Supabase via `supabase-js`, protégée par les **policies RLS** (restreintes au rôle `authenticated`, jamais `anon` — l'app exige une session pour tout écran).
- **Mutations sensibles/multi-étapes** (candidater avec gating freemium, répondre à une candidature + créer le membre, review + recalcul de fiabilité, sync EA, appels IA) : passent par des **Supabase Edge Functions** (`service_role`, contournent RLS mais vérifient l'auth applicative en code à partir du JWT transmis par `supabase.functions.invoke()`), avec validation d'entrée serveur (`supabase/functions/_shared/validate.ts`).
- **`users.push_token`** n'est lisible par personne côté client (`revoke select` sur ce rôle/cette colonne pour `anon`/`authenticated`) — seules les Edge Functions (`service_role`) le lisent pour émettre des push. Toute lecture de `users` côté app utilise la liste de colonnes explicite `USER_PUBLIC_COLUMNS` (`lib/types.ts`), jamais `select("*")`.
- **Atomicité "créer un club"** : un trigger Postgres (`on_club_created`, SECURITY DEFINER) crée le `club_members` OWNER dans la même transaction que l'INSERT du club — le client ne fait qu'un seul appel, plus de risque de club orphelin.
- **`club_sessions.updated_at`** est maintenu par le trigger `handle_updated_at` (extension `moddatetime`) à chaque toggle LIVE, pour que le tri du Live Feed reste cohérent sans que le client n'ait à le gérer.

## Supabase Edge Functions

```
supabase/functions/
  _shared/        cors.ts, supabase.ts (admin client + auth JWT), ea.ts, ai.ts, push.ts
  apply/                    POST — candidature 1 clic (gating 3/jour Free, modération, push)
  respond-application/      POST — accepter/refuser (owner/manager), crée le club_member, push
  submit-review/            POST — review + recalcul reliability_score/streak/badges
  link-ea-club/             POST — lie un club EA, sync best-effort des stats
  ea-sync/                  GET  — cron quotidien, sync stats EA de tous les clubs liés
  season-ranking/           GET  — cron, recalcule divisions + badges de saison
  smart-match/               GET  — Smart Match IA (fallback déterministe)
  scout-report/               GET  — Scout Report IA (Pro only)
  moderate/                    POST — modération générique
  revenuecat-webhook/          POST — synchronise users.plan depuis RevenueCat
```

Déploiement :

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase functions deploy apply respond-application submit-review link-ea-club ea-sync season-ranking smart-match scout-report moderate revenuecat-webhook
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=... CRON_SECRET=... AI_API_KEY=... REVENUECAT_WEBHOOK_SECRET=...
```

`lib/reliability.ts` et `lib/ovr.ts` (calcul de fiabilité et d'OVR) sont **partagés** entre l'app mobile et les Edge Functions via import relatif direct (`../../../lib/reliability.ts`) — une seule source de vérité, aucune duplication de logique.

## Seed data

`prisma/seed.ts` génère 30 users, 10 clubs, 5 sessions live, des candidatures, des reviews (avec recalcul du `reliability_score`), et une saison active avec `season_stats`.

⚠️ Les users seedés ont un `id` (uuid) généré localement, **pas** un compte Supabase Auth réel — ils peuplent le feed/les classements/l'annuaire pour la démo. Pour tester le parcours joueur complet, crée un compte dans l'app (écran de connexion) puis termine l'onboarding.

```bash
npm run prisma:seed
```

## Lancer l'app (iOS / Android)

```bash
npx expo start           # ouvre le menu Metro — scanne le QR avec l'app Expo Go
npx expo start --ios      # simulateur iOS (macOS + Xcode requis)
npx expo start --android  # émulateur Android (Android Studio requis)
```

⚠️ **expo-notifications** et **react-native-purchases** (RevenueCat) sont des modules natifs : ils fonctionnent dans **Expo Go pour la partie UI**, mais les push réelles et les achats in-app nécessitent un **dev build EAS** (`eas build --profile development`, puis `npx expo start --dev-client`).

Vérifications disponibles sans simulateur/device (utilisées pour valider ce projet) :

```bash
npm run typecheck   # tsc --noEmit
npx expo export --platform android   # bundling Metro complet (catch les erreurs d'import/JSX)
npx expo export --platform ios
```

## EAS Build & Submit

```bash
npm install -g eas-cli
eas login
eas init                     # crée le projet EAS, renseigne extra.eas.projectId dans app.json
eas build --profile development --platform ios      # ou android
eas build --profile preview
eas build --profile production
eas submit --platform ios       # App Store Connect (renseigne eas.json > submit)
eas submit --platform android    # Google Play Console (service account JSON)
```

Profils disponibles dans `eas.json` : `development` (dev client), `preview` (interne), `production` (stores).

### Checklist store
- Icônes/splash : remplace les assets par défaut dans `assets/` (icon.png, splash-icon.png, android-icon-*.png) par la charte ClubPro Connect.
- Politique de confidentialité : requise par l'App Store et Google Play dès que Supabase Auth + notifications + achats in-app sont utilisés — héberge une page et renseigne l'URL dans App Store Connect / Play Console.
- Déclaration des achats in-app : configure le produit d'abonnement `pro_monthly` (5€/mois) dans App Store Connect ET Google Play Console, puis dans RevenueCat.

## Cron jobs

Supabase n'a pas d'équivalent direct des Vercel Crons : programme les Edge Functions via **pg_cron + pg_net** (SQL Editor Supabase) :

```sql
select cron.schedule(
  'ea-sync-daily', '0 4 * * *',
  $$ select net.http_get(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/ea-sync',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.cron_secret'))
  ); $$
);

select cron.schedule(
  'season-ranking-daily', '0 5 * * *',
  $$ select net.http_get(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/season-ranking',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.cron_secret'))
  ); $$
);
```

En local, déclenche-les manuellement :

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://YOUR_PROJECT.supabase.co/functions/v1/ea-sync
```

## Brancher RevenueCat

Le MVP livre la **structure complète** (SDK configuré, gestion de l'entitlement `pro`, restauration d'achats, webhook → Supabase) avec des placeholders de clés. Pour activer réellement :

1. Crée un projet [RevenueCat](https://app.revenuecat.com), ajoute les apps iOS + Android.
2. Configure le produit d'abonnement `pro_monthly` (5€/mois) dans App Store Connect / Google Play Console, importe-le dans RevenueCat, crée l'entitlement `pro` et l'offering par défaut.
3. Renseigne `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` (clés SDK publiques, une par plateforme).
4. Passe `EXPO_PUBLIC_FEATURE_REVENUECAT=true`.
5. RevenueCat > Project Settings > Integrations > Webhooks → pointe vers `https://YOUR_PROJECT.supabase.co/functions/v1/revenuecat-webhook`, avec un secret partagé stocké dans `REVENUECAT_WEBHOOK_SECRET` (Supabase secrets).
6. Build un **dev client EAS** pour tester les achats (`react-native-purchases` ne fonctionne pas dans Expo Go).

`lib/revenuecat.ts` centralise `configureRevenueCat()`, `purchasePro()`, `restorePurchases()`.

## Brancher l'IA

`supabase/functions/_shared/ai.ts` est le point d'entrée unique (provider Anthropic par défaut). Pour l'activer :

1. Renseigne `AI_API_KEY` (+ `AI_API_BASE_URL` / `AI_MODEL` si autre provider) dans les secrets Supabase Edge Functions.
2. Chaque feature (Smart Match, Scout Report, Modération) a un **fallback déterministe non-IA** si la clé est absente ou si l'appel échoue — l'app ne casse jamais.
3. Prompts versionnés dans le même fichier (`_V1`) — ajoute un `_V2` pour itérer sans casser l'existant.

## Notifications push

`lib/notifications.ts` demande la permission et enregistre le push token Expo sur `users.push_token` au premier affichage de l'onglet Profil. Les Edge Functions `apply` et `respond-application` envoient les push (nouvelle candidature côté club, réponse côté candidat) via l'API Expo Push — aucune clé requise pour ce provider.

⚠️ Ne fonctionne que sur device réel (pas simulateur/émulateur), et nécessite un dev build EAS pour un test fiable en dehors d'Expo Go.

## Feature flags

| Flag | Défaut | Effet |
|---|---|---|
| `EXPO_PUBLIC_FEATURE_EA_STATS` | `true` | Active le module Verified Stats côté Edge Functions. |
| `EXPO_PUBLIC_FEATURE_AI` | `true` | Active les appels IA réels (sinon fallback déterministe). |
| `EXPO_PUBLIC_FEATURE_REVENUECAT` | `false` | Active RevenueCat (nécessite un dev build EAS + clés). |

(Les flags `FEATURE_EA_STATS` / `FEATURE_AI` côté Edge Functions se règlent séparément dans les secrets Supabase.)

## Structure du projet

```
app/                        Expo Router — écrans (fichiers = routes)
  _layout.tsx                 providers + auth guard (Stack.Protected)
  (auth)/login.tsx
  onboarding.tsx
  (tabs)/                     LIVE | CLUBS | LIGUES | PROFIL (bottom tab bar)
  club/[id].tsx  profile/[id].tsx  dashboard.tsx  pricing.tsx
components/
  ui/          Button, Card, Badge, Input, ChipSelect, PulseDot, Skeleton, Screen, ToastHost
  nav/, club/, live/, profile/
lib/
  supabase/    client.ts (secure-store adapter), secureStoreAdapter.ts
  hooks/       React Query + Supabase Realtime (useLiveSessions, useApplications, ...)
  providers/   AuthProvider (session + profil + guard)
  api/edge.ts   wrapper supabase.functions.invoke()
  reliability.ts   ovr.ts   constants.ts   types.ts   toast.ts   notifications.ts   revenuecat.ts
prisma/
  schema.prisma   seed.ts
supabase/
  migrations/   RLS policies
  functions/    Edge Functions (voir plus haut)
```

## Design system

Thème "e-sport dark" (`tailwind.config.js`) : `bg`/`bg-elevated`/`bg-card` (fond quasi noir), `accent` (vert énergie, statut live), `pro` (violet, features Pro/IA), `rarity.bronze/silver/gold/icon` (ClubPro Card). Typo : Barlow Condensed (titres, `font-display`) + Inter (corps, `font-sans`) via `@expo-google-fonts/*`. Animations natives via **Moti/Reanimated** (`animate` de PulseDot, reveal de la ClubPro Card, transitions d'onboarding). Feedback haptique systématique sur les actions (`expo-haptics`).

## Algorithme de fiabilité

Voir `lib/reliability.ts` (partagé app mobile + Edge Functions).

```
base   = (moyenne_behavior * 0.6) + (moyenne_skill * 0.4)     # sur 5, ramené sur 100
streak = min(streak_actuel * 0.4, 8)                            # bonus régularité, plafonné
ea     = ratio_présence_vérifiée_EA * 6                          # bonus perf vérifiée, plafonné
score  = clamp(base + streak + ea, 0, 100)
```

## Limites connues (MVP)

- **Matching EA ↔ compte** : l'API EA non-officielle n'expose pas d'identifiant stable — rapprochement par égalité `username == playername EA` (documenté dans `supabase/functions/_shared/ea.ts`).
- **Filtre "plateforme" du Live Feed** : le modèle de données ne place `platform` que sur `users`, pas sur `clubs`/`club_sessions` (fidèle au brief). Filtres implémentés : poste, niveau, langue.
- **RevenueCat / clés IA réelles** : non fournies (placeholders `.env.example`) ; tout le reste fonctionne sans elles (fallbacks documentés ci-dessus).
- **Push & achats in-app** : nécessitent un dev build EAS, non testables tels quels dans Expo Go.
- **Un seul dashboard actif** si un joueur gère plusieurs clubs (le MVP affiche le premier ; sélecteur multi-club = TODO Phase 4).
