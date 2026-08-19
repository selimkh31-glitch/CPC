# ClubPro Connect — Prompt de build one-shot (Claude Code)

> Colle ce fichier entier à Claude Code (ou lance `claude` dans un dossier vide et donne-lui ce brief). Il doit builder l'**application mobile native (iOS + Android)** de A à Z, de façon autonome, du bout en bout.

---

## RÔLE

Tu es un ingénieur mobile senior (React Native / Expo) doublé d'un solide bagage backend, spécialisé dans la construction rapide d'apps mobiles MVP lean et production-ready, publiables sur l'App Store et le Google Play Store. Tu travailles de manière **autonome, du début à la fin** : tu crées toute l'arborescence, tous les fichiers, la config, le seed, et un README complet. Tu ne t'arrêtes pas en cours de route pour demander confirmation — tu prends les meilleures décisions par défaut et tu documentes tes choix.

## LE PROJET : ClubPro Connect

La première plateforme de matchmaking **en temps réel** pour la communauté EA SPORTS FC / FIFA **Pro Clubs**. Elle règle trois douleurs du marché : trouver une équipe/des joueurs est fragmenté (Discord, Reddit), les no-shows plombent les sessions, et il n'existe aucune identité compétitive vérifiée.

**Le produit ne vend pas un annuaire — il vend une identité compétitive vérifiée + de la progression.** Le modèle est freemium à 5€/mois.

### Principes directeurs
- **Application mobile native iOS + Android** (une seule base de code cross-platform). Pas de web app.
- Expérience 100% pensée pour le mobile : gestes, navigation par onglets, transitions natives, haptics, safe areas, notifications push.
- Interactions ultra rapides, friction minimale (pas de longs formulaires).
- Temps réel partout où ça compte.
- UI style gaming / e-sport premium, dark mode.

---

## STACK TECHNIQUE (OBLIGATOIRE)

### App mobile (iOS + Android)
- **React Native via Expo** (SDK récent, managed workflow) — une seule base de code pour iOS et Android.
- **TypeScript** (strict).
- **Expo Router** (navigation par fichiers, onglets + stacks natives).
- **NativeWind** (Tailwind pour React Native) pour le styling.
- **Supabase JS client** (`@supabase/supabase-js`) pour Auth + Realtime + data, avec stockage sécurisé de session (`expo-secure-store`).
- Gestion d'état légère : React hooks + React Query (`@tanstack/react-query`) pour le cache/data-fetching. Pas de Redux.
- **expo-notifications** pour les push (candidatures, réponses, sessions live).
- **react-native-reanimated** + **moti** pour les animations (reveal de la ClubPro Card, pulse du live).
- Haptics via `expo-haptics`, icônes via `lucide-react-native`.
- Build & distribution via **EAS Build / EAS Submit** (App Store + Google Play).

### Backend
- **Supabase** (Auth + Postgres + Realtime + Row Level Security) comme backend principal.
- **Prisma ORM** utilisé côté outils/serveur pour les migrations, le schéma et le seed.
- Les jobs planifiés (cron stats EA, calcul des classements) et les appels IA tournent dans des **Supabase Edge Functions** (ou un petit service Node séparé) — jamais depuis l'app cliente, pour ne pas exposer de clés.

---

## 1. AUTHENTIFICATION & ONBOARDING

- Auth email/mot de passe via Supabase.
- Username unique.
- Sélection de plateforme (PS / Xbox / PC).
- Onboarding en étapes courtes : username → plateforme → poste principal + postes secondaires → style de jeu → langue → dispo. Aucune étape ne doit prendre plus de 10s.
- Protection des écrans authentifiés (auth guard dans le layout Expo Router : redirection vers l'écran de login si pas de session).
- Session persistée de façon sécurisée (`expo-secure-store`), reconnexion automatique au lancement de l'app.

## 2. MODÈLE DE DONNÉES (Prisma + Supabase, avec RLS)

**users** : id, username (unique), platform, main_position, secondary_positions (array), play_style, languages (array), availability (json), reliability_score (float default 0), verified_stats (json nullable), ea_club_linked (string nullable), plan (free/pro, default free), created_at

**clubs** : id, name, owner_id (FK users), level (casual/competitive), description, languages (array), ea_club_id (string nullable), created_at

**club_members** : id, club_id (FK), user_id (FK), role (owner/manager/member), joined_at

**club_sessions** (système LIVE) : id, club_id (FK), is_live (bool), needed_positions (array), note (text nullable), created_at, updated_at

**applications** : id, user_id (FK), club_id (FK), session_id (FK), status (pending/accepted/rejected), message (text nullable), created_at

**reviews** : id, reviewer_id (FK), target_user_id (FK), rating_skill (1-5), rating_behavior (1-5), showed_up (bool), comment (text nullable), created_at

**seasons** : id, name, starts_at, ends_at, is_active (bool)

**season_stats** : id, season_id (FK), user_id (FK), goals, assists, clean_sheets, matches_played, mvp_count, points, division (int), updated_at

Ajoute les relations, index et policies RLS appropriées (un user édite son profil, un owner gère son club, etc.).

## 3. FEATURES CŒUR (MVP)

### A. Profil joueur — "ClubPro Card"
- Page profil éditable.
- **Composant carte animée type FIFA** (signature du produit) : OVR calculé, poste, style, forme, badge de rareté visuelle (bronze / argent / or / icon selon le score), badge "✓ Verified Stats" si stats EA liées.
- Affichage des reviews reçues + moyennes skill/comportement.
- La carte doit être belle, screenshotable, partageable. C'est le hook viral.

### B. Dashboard club
- Créer / éditer un club.
- Toggle session LIVE ON/OFF.
- Sélection des postes recherchés + note optionnelle.
- Voir les candidatures entrantes en temps réel, accepter/refuser instantanément.
- Gestion des membres et rôles.

### C. Live Matchmaking Feed (FEATURE CLÉ)
- Fil temps réel de tous les clubs actuellement LIVE.
- Affiche : nom du club, postes recherchés, niveau, langue, indicateur "live" qui pulse.
- Filtres : plateforme, poste, niveau, langue.
- Auto-refresh via Supabase Realtime.
- Expérience aussi rapide et nerveuse qu'une app de swipe.

### D. Système de candidature
- Bouton "Postuler" en 1 clic.
- Message optionnel + sélection du poste.
- Le responsable reçoit en temps réel et accepte/refuse instantanément (notif des deux côtés).

### E. Trust Engine (fiabilité)
- Après chaque session, check rapide : "présent / a lâché / bon esprit".
- Score de fiabilité **public** qui influe sur le classement des candidatures (fiables en tête, no-shows enterrés).
- Système de streak (X sessions honorées d'affilée = badge + boost).

### F. Ligues & Saisons (rétention)
- Saison mensuelle avec divisions, montées/descentes.
- Classements : buteurs, passeurs, gardiens (clean sheets), MVP.
- Récompenses = badges de saison affichés sur la ClubPro Card.
- Job de calcul de classement (Supabase Edge Function planifiée via cron).

## 4. INTÉGRATION STATS EA (module "Verified Stats")

**Important : ce n'est PAS une API officielle EA.** Ce sont des endpoints semi-publics découverts par la communauté (`proclubs.ea.com/api/fc/...`). Ils sont fonctionnels mais **instables** (pannes, SSL expiré par intermittence, rate-limiting).

Implémente donc une couche **défensive et mise en cache**, jamais un appel direct depuis l'app cliente (tout passe par le backend / une Edge Function) :

- Recherche d'un club EA par nom → récupération de l'`ea_club_id` :
  `https://proclubs.ea.com/api/fc/allTimeLeaderboard/search?platform=common-gen5&clubName={name}`
- Récupération des matchs et stats membres d'un club :
  `https://proclubs.ea.com/api/fc/clubs/matches?platform={platform}&clubIds={id}&matchType=leagueMatch&maxResultCount=10`
  (aussi `matchType=friendlyMatch`)
- Prévois une abstraction propre (un module `ea/` dans le backend / Edge Function) avec : headers navigateur réalistes, retries avec backoff, timeout, et **fallback silencieux** vers les stats déclaratives si l'API est down.
- Un **job planifié** (Supabase Edge Function + cron) récupère une fois par jour les stats des clubs liés et les stocke dans Supabase (`users.verified_stats` / `season_stats`). L'app cliente ne lit QUE cette copie en cache.
- Quand un joueur a lié son club, sa ClubPro Card affiche le badge "✓ Verified Stats" et ses vrais chiffres (buts, passes, matchs, notes).
- Le score de fiabilité devient **hybride** : comportement (reviews) + performance vérifiée (data EA) + régularité (matchs récents détectés).

Isole ce module proprement pour qu'on puisse le désactiver via un feature flag si les endpoints EA cassent.

## 5. IA (via appels API, sans modèle à entraîner)

Structure chaque usage comme : prompt structuré → réponse JSON → consommée par l'app. Mets tous les appels côté serveur (Supabase Edge Functions), jamais de clé exposée dans l'app mobile. Rends chaque feature IA désactivable par feature flag.

- **Smart Match** : quand un joueur cherche, classe les clubs live par compatibilité (poste manquant, niveau, langue, dispo, style, fiabilité) → score 0-100 + une phrase d'explication ("Ce club cherche ton poste, joue à ton niveau, 3 membres parlent français").
- **Scout Report** : mini-résumé de perf hebdo par joueur généré depuis ses reviews + stats vérifiées ("En forme sur l'aile droite, ponctuel, à travailler : le repli").
- **Modération** : filtrage léger des messages/comportements toxiques signalés.

Prévois une couche d'abstraction `lib/ai/` avec un provider unique et des prompts versionnés, pour pouvoir changer de modèle facilement.

## 6. MODÈLE FREEMIUM (5€/mois)

Implémente la logique de gating (champ `plan` sur users) :

- **Free** : profil de base, voir le feed, candidatures limitées (ex. 3/jour), carte basique.
- **Pro (5€/mois)** : candidatures illimitées, carte animée premium + raretés, filtres avancés, priorité dans les candidatures, Scout Report IA, ligues classées, badges de saison, Verified Stats.

Prépare l'intégration paiement mobile. **Important** : sur iOS et Android, la vente d'abonnements numériques doit passer par les achats in-app des stores (App Store / Google Play), pas par Stripe directement. Utilise donc **RevenueCat** (par-dessus StoreKit / Google Play Billing) pour gérer l'abonnement Pro à 5€/mois de façon cross-platform. Structure l'intégration (SDK, gestion de l'entitlement `pro`, restauration d'achats, webhook RevenueCat → Supabase pour synchroniser le champ `plan`), mets des placeholders clairs pour les clés, et documente le branchement dans le README. Ne code pas de logique de facturation complexe au-delà du MVP.

## 7. DESIGN & UI/UX

- **Dark mode e-sport** : fond quasi noir, accent principal vert énergie (type "live"), un accent secondaire, typo condensée sportive pour les titres.
- Animations subtiles : pulse du live, reveal de la carte joueur, transitions fluides.
- Doit ressembler à un écran de jeu compétitif, pas à un SaaS B2B.
- Système de design cohérent : composants UI réutilisables, tokens de couleur/espacement, accessibilité de base (contraste, focus).
- Natif et fluide sur toutes les tailles d'écran (petits téléphones aux grands), safe areas et encoches gérées, mode sombre par défaut.

### Navigation & écrans (Expo Router)
- **Barre d'onglets (tab bar)** en bas, façon app native, avec 4-5 onglets principaux : **Live** (feed), **Clubs**, **Ligues**, **Profil**, (+ Dashboard pour les owners).
- Écrans hors onglets (stacks) : `login`, `onboarding` (flow multi-étapes), `club/[id]`, `profile/[id]`, `pricing`/paywall, réglages.
- Onboarding en modale/stack plein écran au premier lancement.
- Transitions natives, gestes de retour, safe areas gérées, tab bar en dark.

## 8. TEMPS RÉEL (Supabase Realtime)

- Sessions live (apparition/disparition dans le feed).
- Nouvelles candidatures.
- Changements de statut de candidature.
- Présence en ligne des joueurs.

## 9. ALGORITHME DE FIABILITÉ

Base : `reliability_score = (moyenne_behavior * 0.6) + (moyenne_skill * 0.4)`
Puis enrichis : ajoute un facteur de régularité (fréquence de sessions honorées) et, si dispo, un facteur de performance vérifiée EA. Documente la formule finale dans le code.

## 10. SEED DATA

Génère des données mock réalistes : 30 users (postes/plateformes/langues variés, scores de fiabilité divers), 10 clubs, 5 sessions live, quelques candidatures, reviews, et une saison active avec des season_stats. De quoi que le feed et les classements soient vivants dès le premier lancement.

## 11. BUILD, TESTS & PUBLICATION

- L'app tourne sur simulateur iOS, émulateur Android et sur device réel via **Expo Go** / dev build (`npx expo start`).
- Configuration **EAS** (`eas.json`) prête pour les builds de développement, preview et production.
- `app.json` / `app.config.ts` complet : nom, slug, bundle identifier iOS, package Android, icônes, splash screen, permissions (notifications), schéma d'URL.
- README complet couvrant :
  - setup Supabase (URL, anon key, service role, DB password) + variables d'env (`.env.example` documenté, chargées via `expo-constants` / `app.config`).
  - commandes Prisma (generate, migrate, seed) pour le schéma et les données.
  - lancement local (iOS + Android), build via **EAS Build**, soumission via **EAS Submit** vers l'App Store et le Google Play Store.
  - déploiement des Supabase Edge Functions + activation des crons (stats EA, classements).
  - branchement de RevenueCat (abonnement Pro) et des clés IA plus tard.
- Checklist store : assets requis (icône, screenshots), politique de confidentialité, déclaration des achats in-app.
- `.gitignore` propre. Structure de projet claire et commentée.

---

## ORDRE DE CONSTRUCTION (respecte-le)

**Phase 1 (le cœur — must be perfect)** : setup projet + stack, schéma Prisma + RLS, auth + onboarding, Live Feed temps réel, candidature 1 clic, ClubPro Card, Trust Engine basique, seed. → C'est le MVP payable.

**Phase 2** : module Verified Stats EA (avec cache + fallback), Smart Match IA, Scout Report, filtres avancés, notifications.

**Phase 3** : Ligues, saisons, classements, récompenses, gating freemium + placeholders Stripe.

**Phase 4** : social (tag coéquipier, partage de carte), polish design final.

Construis dans cet ordre, mais livre le projet complet. Après chaque phase, laisse un court récap de ce qui a été fait et des TODO restants.

---

## CONTRAINTES FINALES

- Code production-ready, typé, commenté là où c'est utile.
- Aucune clé secrète en dur — tout en variables d'environnement.
- Le module EA et les features IA doivent être isolés et désactivables par feature flag.
- Gère les erreurs proprement (surtout autour de l'API EA instable et des appels IA).
- Priorité : que le MVP de Phase 1 soit impeccable, rapide et beau — natif et fluide **sur iOS comme sur Android**.

Commence maintenant. Travaille en autonomie de bout en bout.
