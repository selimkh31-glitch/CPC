# ClubPro Connect — dossier d’implémentation UI/UX

## Portée et autorité

Cette application web est uniquement la référence visuelle et interactive mobile de CPC. Elle n’implémente ni authentification réelle, ni réseau, ni persistance, ni règles métier. Le projet Expo / React Native de production reste l’unique source de vérité pour Supabase, RLS, Realtime, matchmaking, cycle LIVE, invitations, candidatures, formations, chat, avis et sécurité.

## Structure de navigation

Le prototype utilise une seule URL web (`/`) et un contrôleur local typé `CpcScreen`. Lors du portage, chaque identifiant ci-dessous doit devenir un écran ou une destination de navigation native, sans modifier les règles et noms de routes déjà présents dans l’application de production.

### Inventaire des 27 surfaces

| #   | Identifiant     | Surface                   | Éléments principaux                                | États / CTA                              | Destination                      |
| --- | --------------- | ------------------------- | -------------------------------------------------- | ---------------------------------------- | -------------------------------- |
| 1   | `splash`        | Ouverture                 | Marque CPC                                         | Ouvrir le prototype                      | `auth`                           |
| 2   | `auth`          | Bienvenue                 | Logo, promesse, actions de connexion factices      | Apple, e-mail                            | `intent`                         |
| 3   | `intent`        | Choix du parcours         | Choix joueur / manager                             | Trouver un club, trouver des joueurs     | `home` avec rôle                 |
| 4   | `home`          | Accueil                   | Actions principales, métriques, invitation récente | Joueur, manager, activité, invitation    | écrans associés                  |
| 5   | `liveSetup`     | Configuration LIVE joueur | Poste principal, secondaires, durée                | Modifier, sélectionner, passer en LIVE   | feuille poste, `liveActive`      |
| 6   | `liveActive`    | LIVE joueur               | Minuteur, postes, clubs correspondants             | Modifier, arrêter, tout voir, invitation | `liveSetup`, `clubs`, `inviteIn` |
| 7   | `clubs`         | Clubs LIVE                | Recherche, filtres, cartes club                    | états chargé/chargement/vide/erreur      | `club`, feuille filtres          |
| 8   | `club`          | Détail club               | Identité, raisons, postes, style                   | Voir l’invitation                        | `inviteIn`                       |
| 9   | `inviteIn`      | Invitation reçue          | Club, poste, formation, plateforme, message        | Refuser, accepter                        | `activity`, `accepted`           |
| 10  | `accepted`      | Confirmation              | Confirmation d’entrée dans l’équipe                | Feuille de match, chat                   | `match`, `chat`                  |
| 11  | `match`         | Feuille de match joueur   | Formation, état d’équipe                           | Profil du club, chat                     | `clubProfile`, `chat`            |
| 12  | `managerSetup`  | Configuration recrutement | Club, formation, postes libres, correspondances    | Choix de formation, lancer               | `managerLive`                    |
| 13  | `managerLive`   | Recrutement LIVE          | État, formation, métriques                         | Arrêter, sélectionner un poste           | `players`                        |
| 14  | `formation`     | Formation manager         | Terrain et état des postes                         | Sélectionner un poste libre              | `players`                        |
| 15  | `players`       | Joueurs LIVE              | Liste des profils correspondants                   | Voir, inviter, états de données          | `player`, `pending`              |
| 16  | `player`        | Détail joueur             | Profil, postes, fiabilité, avis, raisons           | Avis, inviter                            | `reviews`, `pending`             |
| 17  | `pending`       | Invitation envoyée        | Destinataire et poste                              | Simuler l’acceptation, retour            | `formation`, `managerLive`       |
| 18  | `activity`      | Activité                  | Segments et événements                             | Tout, invitations, acceptées             | invitation, attente, avis        |
| 19  | `notifications` | Notifications             | Invitations, arrivée, fin de LIVE                  | Ouvrir l’élément                         | destination concernée            |
| 20  | `messages`      | Conversations             | Liste des salons                                   | Ouvrir                                   | `chat`                           |
| 21  | `chat`          | Chat d’équipe             | En-tête session, messages, saisie                  | Envoyer                                  | reste sur `chat`                 |
| 22  | `profile`       | Profil joueur             | Identité, postes, fiabilité, avis                  | Réglages, avis, club géré                | écrans associés                  |
| 23  | `clubProfile`   | Profil club               | Identité, fiabilité, besoins                       | Lire les avis                            | `reviews`                        |
| 24  | `reviews`       | Avis                      | Note, liste d’avis                                 | états de données, retour profil          | `profile`                        |
| 25  | `positionSheet` | Feuille poste             | Grille des postes                                  | Choisir                                  | ferme vers `liveSetup`           |
| 26  | `filtersSheet`  | Feuille filtres           | Critères de recherche                              | Cocher, fermer                           | ferme vers `clubs`               |
| 27  | `statePreview`  | Couche de démonstration   | Chargé, chargement, vide, erreur                   | Changer d’état, réessayer                | écran courant                    |

La barre principale contient **Accueil, Live, Activité, Messages, Profil**. L’entrée Live mène à `liveActive` pour un joueur et `managerLive` pour un manager. Les écrans de détail utilisent un retour empilé localement dans le prototype.

## Parcours joueur

1. `splash` → `auth` → `intent` → choix **Je suis joueur** → `home`.
2. **Trouver un club** → `liveSetup` → choix des postes et de la durée → `liveActive`.
3. Depuis le LIVE : modifier/arrêter, consulter `clubs`, rechercher/filtrer, ouvrir `club`.
4. Ouvrir `inviteIn` → refuser vers `activity`, ou accepter vers `accepted`.
5. Après acceptation : `match` et/ou `chat`, puis consultation de `clubProfile` et `reviews`.
6. Navigation transversale : `activity`, `notifications`, `messages`, `profile`, `settings`.

## Parcours manager

1. `splash` → `auth` → `intent` → choix **Je gère un club** → `home`.
2. **Trouver des joueurs** → `managerSetup` → formation et postes → `managerLive`.
3. Toucher un poste libre → `players` → consulter `player` ou inviter directement.
4. Invitation envoyée → `pending` → retour au recrutement ou simulation d’acceptation.
5. Après acceptation : `formation` affiche le poste pourvu; activité, notifications et chat reflètent cet état de démonstration.

## Composants réutilisables

### Fondations

- `AppShell`, `AppHeader`, `BottomNavigation`, `Logo`
- `Button`, `Input`, `Sheet` (bibliothèque web, à mapper aux composants natifs existants)
- `SurfaceCard`, `Avatar`, `LiveBadge`, `StatusBadge`, `PositionBadge`, `MatchReasonBadge`
- `SectionHeader`, `Metric`, `InfoRow`, `ProfileRow`, `SearchInput`

### Modèles métier visuels

- `PlayerCard`, `ClubCard`
- `Formation`, `FormationSlot`
- `ActivityRow`, `NotificationRow`, `ConversationRow`
- `ChatMessage`, `ChatComposer`
- `StatePreview`, `StateContent`, `SkeletonList`, `EmptyState`

## Source de vérité des tokens

`src/design/cpc-tokens.ts` est la source typée canonique. `src/styles.css` en est le miroir web.

- `color`: fonds, surfaces, textes, bordures, accent, LIVE, succès, avertissement, erreur, désactivé, voile, terrain.
- `font`: Barlow Condensed pour l’affichage, Inter pour l’interface; graisses, tailles, hauteurs de ligne et espacements.
- `spacing`: échelle 0–64 px.
- `radius`: contrôle 2 px, carte 0, badge 2 px, champ 4 px, feuille 16 px, téléphone 28 px, rond complet.
- `border`: 1 px standard, 2 px renforcé.
- `shadow`: carte, téléphone, focus.
- `opacity`: subtil, doux, bordure, atténué, fort, voile, opaque.
- `icon`, `avatar`, `geometry`: tailles d’icônes, avatars, cible tactile 44 px, barres, cartes, terrain, largeur/hauteur du téléphone.
- `motion`: 120/200/550 ms, entrée/sortie de feuille et pulsation LIVE; désactivation sous réduction des animations.
- `status`: LIVE, succès, avertissement, erreur, en attente, acceptée, refusée, expirée, indisponible.

## Correspondance web → React Native / Expo

| Référence web                | Équivalent natif attendu                                                        |
| ---------------------------- | ------------------------------------------------------------------------------- |
| conteneur / texte            | `View` / `Text`                                                                 |
| bouton / ligne interactive   | `Pressable` ou composant Button CPC existant                                    |
| zone défilante               | `ScrollView` ou `FlatList` selon volume                                         |
| liste joueurs/clubs/messages | `FlatList` avec clés stables                                                    |
| champ de recherche / chat    | `TextInput` contrôlé                                                            |
| feuille basse                | composant Bottom Sheet déjà retenu en production                                |
| en-tête et barre basse       | navigateurs Expo Router existants, zones sûres natives                          |
| icônes Lucide web            | `lucide-react-native` avec tailles des tokens                                   |
| terrain positionné           | `View` avec `position: absolute` et coordonnées en pourcentage                  |
| transitions CSS              | Reanimated/Moti existant, mêmes durées et réduction de mouvement                |
| `aria-*` / focus             | `accessibilityLabel`, `accessibilityRole`, `accessibilityState`, ordre de focus |

Ne pas copier le contrôleur de navigation web dans la production. Mapper les surfaces aux routes Expo Router et aux stores/hooks métier existants.

## Données de démonstration et limites de remplacement

Toutes les données de démonstration résident dans `src/lib/cpc-mock-data.ts`: joueurs, clubs, formations, conversations, avis, postes, durées, filtres, métriques, invitation, session, chat, activité, notifications et réglages. Les composants de présentation reçoivent ces valeurs par propriétés ou depuis le contrôleur du prototype.

Au portage, remplacer uniquement les fixtures par les modèles, requêtes, mutations, abonnements et états déjà présents dans CPC production. Ne jamais transposer les simulations (`setInviteStatus`, minuteur local, acceptation simulée), les nombres de démonstration ou les critères de correspondance dans la logique réelle.

## Exigences mobiles et accessibilité

- Référence primaire: **390 × 844 px**; largeur utile plafonnée à 430 px sur le web.
- Respecter `SafeAreaView` / insets en haut et en bas; la barre basse reste hors du contenu défilant.
- Chaque écran possède une seule zone verticale défilante; les feuilles ont leur propre défilement si nécessaire.
- Les actions principales et contrôles ont une cible minimale de **44 × 44 px**.
- Le chat doit utiliser `KeyboardAvoidingView`, conserver le compositeur visible et permettre le défilement vers le dernier message.
- Les noms longs sont tronqués seulement dans les listes; le détail doit permettre la lecture complète ou un retour à la ligne.
- Les libellés français doivent rester lisibles avec la taille de texte système augmentée; ne pas réduire la police selon la largeur.
- Fournir rôles, libellés et états accessibles; ne jamais dépendre uniquement de la couleur pour LIVE ou un statut.
- Respecter la réduction des animations; conserver une confirmation statique lorsque l’animation est supprimée.
- Le terrain garde son ratio et ses emplacements; les libellés des postes ne doivent jamais se superposer.

## Validation finale

- TypeScript: aucun défaut.
- ESLint: aucun défaut bloquant; avertissements Fast Refresh uniquement dans des fichiers de bibliothèque partagée.
- Parcours vérifiés à 390 × 844: joueur LIVE, recherche club, invitation, acceptation, chat et envoi; manager, formation, recherche joueur, invitation et acceptation; profil et réglages.
- Aucun débordement horizontal ni erreur navigateur observé sur les branches vérifiées.
- Les contrôles de démonstration d’état sont explicitement réservés à cette référence et ne doivent pas apparaître dans l’application de production.

## Incohérences restantes

Aucune incohérence visuelle ou fonctionnelle bloquante connue dans la référence. Les nombres, noms, avis et délais visibles sont volontairement des données fictives de démonstration; ils ne constituent ni des statistiques EA ni des règles produit.
