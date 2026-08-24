import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronDown, ChevronUp, Globe2, Mail, Users } from "lucide-react-native";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { PulseDot } from "@/components/ui/PulseDot";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState, EmptyState } from "@/components/ui/Screen";
import { FormationPitch } from "@/components/club/FormationPitch";
import { FormationSelector } from "@/components/club/FormationSelector";
import { MatchCheckinPanel } from "@/components/club/MatchCheckinPanel";
import { LiveSessionPanel } from "@/components/club/LiveSessionPanel";
import { EditClubForm } from "@/components/club/EditClubForm";
import { VoiceLinkBlock } from "@/components/club/VoiceLinkBlock";
import { ModeSwitch } from "@/components/club/ModeSwitch";
import { CLUB_LEVEL_LABELS, LANGUAGE_LABELS, POSITION_LABELS, type PositionCode } from "@/lib/constants";
import { FORMATIONS, type FormationId, type FormationSlot } from "@/lib/formations";
import { findActiveLiveSession } from "@/lib/live";
import { useManagedClub } from "@/lib/hooks/useManagedClub";
import { useMyMemberships } from "@/lib/hooks/useClubs";
import { useClubInvitations } from "@/lib/hooks/useInvitations";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useAppMode } from "@/lib/providers/AppModeProvider";

/**
 * MATCH — Foundation #2.2. Fusion de l'ancien Dashboard + Composition en un
 * seul écran continu ("Préparer le match" avant LIVE, devient le "Match
 * Center" une fois live) — même contexte, même route, le contenu se
 * réorganise selon `activeSession` (aucune nouvelle route créée, conformément
 * à la consigne). Réutilise tous les composants existants tels quels
 * (LiveSessionPanel, FormationSelector, FormationPitch, MatchCheckinPanel,
 * VoiceLinkBlock, EditClubForm) — aucune logique métier dupliquée ni réécrite.
 * Remplace app/(club)/(tabs)/dashboard.tsx et composition.tsx (supprimés,
 * aucun lien externe ne pointait vers ces noms de tab — voir audit).
 */
export default function MatchTab() {
  const { session } = useAuth();
  const { data: club, isLoading, isError, refetch } = useManagedClub();
  const { data: memberships } = useMyMemberships(session?.user.id ?? null);
  const { setSelectedManagedClubId } = useAppMode();
  const [editing, setEditing] = useState(false);
  // Phase G.3.2 — signalé par MatchCheckinPanel (onLiveChange) dès qu'il
  // affiche un état "Match Day" (ready/live/finalize/finalized). Piloté par
  // callback plutôt que par un second appel à useActiveMatchCheckin ici :
  // reste synchronisé EXACTEMENT avec l'état interne réel du panel (y
  // compris pendant la fenêtre de resynchronisation juste après
  // finalize-match), sans dupliquer/déplacer sa state machine.
  const [isMatchDay, setIsMatchDay] = useState(false);
  // Repliée par défaut dès que le Match Day commence (audit G.3.1 section
  // H/8) — reste accessible en un tap, jamais supprimée. Toujours dépliée
  // avant le Match Day (comportement identique à avant G.3).
  const [prepExpanded, setPrepExpanded] = useState(false);

  const managedClubs = memberships?.filter((m) => m.role === "OWNER" || m.role === "MANAGER") ?? [];

  if (isLoading || !club) {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          {isError ? <ErrorState message="Impossible de charger ce club." onRetry={refetch} /> : <Skeleton className="h-[420px]" />}
        </ScrollView>
      </SafeAreaView>
    );
  }

  const activeSession = findActiveLiveSession(club.sessions, Date.now());
  const formationId = (club.formation as FormationId | null) ?? null;
  const assignments = club.slotAssignments ?? [];

  // Banc — même dérivation à plat que ClubHome (Mode Joueur) : tout membre
  // sans slot_assignment. Pas un nouveau composant partagé, juste la même
  // petite dérivation locale déjà utilisée ailleurs dans le repo.
  const startingUserIds = new Set(assignments.map((a) => a.user_id));
  const bench = (club.members ?? []).filter((m) => !startingUserIds.has(m.user_id));

  const onEmptySlotPress = (slot: FormationSlot) => {
    router.push(`/player-search?clubId=${club.id}&slotId=${slot.slotId}&position=${slot.position}`);
  };

  // Phase G.3.2 — abandon du takeover plein-écran de G.3 (audit G.3.1 :
  // "CINEMATIC ne signifie pas fullscreen"). Le Match Day ne masque plus la
  // tab bar ni le club (ModeSwitch/header) — seule la section "Préparation"
  // (formation/banc/session/vocal/invitations) devient repliable dès que le
  // Match Day commence, jamais supprimée (section 8). `MatchCheckinPanel`
  // reste TOUJOURS le même enfant, à la même position, du même ScrollView
  // (clé stable `match-checkin-panel`) — c'est la même garantie architecturale
  // qu'en G.3 (React réconcilie par position/clé, jamais par "intention" —
  // un `return` séparé démonterait/remonterait le panel et perdrait son state
  // interne à chaque bascule). `editing` garde la priorité si déjà ouvert.
  const prepVisible = !isMatchDay || prepExpanded;

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 16 }} keyboardShouldPersistTaps="handled">
        <ModeSwitch managedClubs={managedClubs} />

        {/* 1. Header club — toujours visible (identité + Réglages), Match
            Day ou non : ce n'est pas un outil de préparation, juste
            l'identité du club (section 2, coquille persistante). */}
        <View className="flex-row items-start justify-between">
          <View className="shrink">
            <Text className="font-display text-2xl text-fg">{club.name}</Text>
            <View className="mt-1 flex-row flex-wrap items-center gap-2">
              <Badge tone={club.level === "COMPETITIVE" ? "accent" : "neutral"}>{CLUB_LEVEL_LABELS[club.level]}</Badge>
              <View className="flex-row items-center gap-1">
                <Globe2 size={12} color="#666c74" />
                <Text className="text-xs text-fg-subtle">{club.languages.map((l) => LANGUAGE_LABELS[l] ?? l).join(", ")}</Text>
              </View>
            </View>
          </View>
          {club.owner_id === session?.user.id && !editing && (
            <Text className="text-sm text-fg-muted" onPress={() => setEditing(true)} suppressHighlighting>
              Réglages
            </Text>
          )}
        </View>

        {/* 1bis. Match Day Cockpit — placé ICI (juste après le header, avant
            la Préparation) uniquement pendant le Match Day, pour rester
            l'élément dominant de l'écran (hiérarchie demandée : MATCH STATE
            en priorité, préparation secondaire). Avant le Match Day, ce même
            élément (même `key`) est rendu plus bas, à sa position historique
            (après la Préparation) — un changement de POSITION parmi les
            enfants d'un même parent, jamais un démontage : React réconcilie
            par clé, pas par ordre du JSX source (même garantie qu'en G.3,
            appliquée ici au réordonnancement plutôt qu'au show/hide). */}
        {isMatchDay && formationId && !editing && (
          <MatchCheckinPanel
            key="match-checkin-panel"
            clubId={club.id}
            sessionId={activeSession?.id ?? null}
            formationId={formationId}
            assignments={assignments}
            members={club.members ?? []}
            onLiveChange={setIsMatchDay}
          />
        )}

        {editing ? (
          <EditClubForm club={club} onDone={() => setEditing(false)} />
        ) : (
          <>
            {/* Bascule "Préparation" — visible uniquement une fois le Match
                Day commencé (avant, la préparation EST l'écran, pas besoin
                d'un bouton pour la déplier). */}
            {isMatchDay && (
              <Pressable
                onPress={() => setPrepExpanded((v) => !v)}
                className="flex-row items-center justify-between rounded-xl border border-border bg-bg-elevated px-3 py-2.5 active:opacity-80"
              >
                <Text className="text-sm font-bold text-fg-muted">Préparation</Text>
                {prepExpanded ? (
                  <ChevronUp size={16} color="#9aa0a8" />
                ) : (
                  <ChevronDown size={16} color="#9aa0a8" />
                )}
              </Pressable>
            )}

            {prepVisible && (
              <>
                {/* Transition Préparation -> Match Center perceptible dans le
                    titre + le badge LIVE, sans nouvelle route ni animation.
                    NB : ce badge "LIVE" concerne la session de recrutement
                    (activeSession/postes recherchés) — un concept distinct
                    du Match Day (check-in/cockpit), pas touché ici. */}
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <Text className="font-display text-lg text-fg">{activeSession ? "Match Center" : "Préparer le match"}</Text>
                    {activeSession && (
                      <View className="flex-row items-center gap-1">
                        <PulseDot />
                        <Text className="text-xs font-extrabold text-accent">LIVE</Text>
                      </View>
                    )}
                  </View>
                  <FormationSelector clubId={club.id} currentFormation={formationId} hasAssignments={assignments.length > 0} />
                </View>

                {/* 2a. Formation éditable — recrutement conservé tel quel
                    (onEmptySlotPress -> player-search, moteur inchangé). */}
                {formationId ? (
                  <FormationPitch
                    formationId={formationId}
                    assignments={assignments}
                    onEmptySlotPress={onEmptySlotPress}
                    emptySlotHint="Trouver un remplaçant"
                  />
                ) : (
                  <EmptyState title="Choisis une formation pour composer ton équipe." />
                )}

                {/* 2b. Banc */}
                {bench.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle icon={<Users size={18} color="#f4f5f7" />}>Banc</CardTitle>
                      <Text className="text-sm text-fg-muted">{bench.length}</Text>
                    </CardHeader>
                    <View className="gap-1.5">
                      {bench.map((m) => (
                        <Pressable
                          key={m.user_id}
                          onPress={() => router.push(`/profile/${m.user_id}`)}
                          className="active:opacity-70"
                        >
                          <Text numberOfLines={1} className="text-sm text-fg">
                            {m.user?.username ?? "Joueur"}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </Card>
                )}

                {/* 2c. Postes recherchés + Note + Passer LIVE/OFFLINE — un seul
                    bloc atomique (LiveSessionPanel), réutilisé sans le
                    décomposer : "définir le besoin" et "publier" restent une
                    seule action cohérente, pas trois écrans séparés. */}
                <LiveSessionPanel
                  clubId={club.id}
                  activeSession={
                    activeSession
                      ? {
                          id: activeSession.id,
                          needed_positions: activeSession.needed_positions,
                          note: activeSession.note,
                          expires_at: activeSession.expires_at,
                        }
                      : null
                  }
                />

                {/* 2d. Vocal */}
                <VoiceLinkBlock voiceLink={club.voice_link} />

                {/* 3. Invitations en attente — Foundation #2.3 : visible en
                    permanence, PAS conditionné à activeSession. Le recrutement
                    (slot vide -> player-search) est accessible dès la
                    préparation, avant LIVE — une invitation envoyée à ce
                    moment-là doit rester visible tout de suite, pas seulement
                    après le passage LIVE (cause exacte identifiée en recette :
                    la condition activeSession masquait ce cas réel). Même
                    philosophie que MatchCheckinPanel juste en dessous, qui gère
                    déjà lui-même son état "pas de session" sans condition
                    externe — PendingInvitations fait pareil via son propre état
                    vide ("Aucune invitation en attente."). Lecture seule, moteur
                    de recrutement inchangé. */}
                <PendingInvitations clubId={club.id} formationId={formationId} />
              </>
            )}
          </>
        )}

        {/* 4. Check-in — position HISTORIQUE (après la Préparation), utilisée
            uniquement avant le Match Day (workflow inchangé : composer
            l'équipe d'abord, check-in en dernier). Même élément/même `key`
            que la version rendue plus haut pendant le Match Day (voir 1bis) —
            jamais les deux en même temps (`isMatchDay` / `!isMatchDay`
            mutuellement exclusifs), donc jamais deux instances réelles. */}
        {!isMatchDay && formationId && !editing && (
          <MatchCheckinPanel
            key="match-checkin-panel"
            clubId={club.id}
            sessionId={activeSession?.id ?? null}
            formationId={formationId}
            assignments={assignments}
            members={club.members ?? []}
            onLiveChange={setIsMatchDay}
          />
        )}

        {managedClubs.length > 1 && (
          <Pressable onPress={() => setSelectedManagedClubId(null)} className="active:opacity-80">
            <Text className="text-center text-sm text-accent">Changer de club — tu en gères {managedClubs.length}</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Invitations MATCH PENDING envoyées par ce club (slot_id non-null
 * uniquement — jamais les invitations CLUB générales, affichées séparément
 * par ClubInvitationsPanel dans Candidatures) — lecture seule,
 * `useClubInvitations` (lib/hooks/useInvitations.ts), RLS déjà suffisante.
 * `useClubInvitations` renvoie désormais tous les statuts ET tous les types
 * (élargi pour Candidatures → Invitations envoyées + Effectif → Inviter au
 * club, voir son docstring) : ce composant filtre PENDING + slot_id non-null
 * lui-même pour garder EXACTEMENT le même périmètre Match Day qu'avant —
 * aucun état métier déduit au-delà de ce filtre. Le poste est résolu via
 * slot_id -> FORMATIONS (même pattern que MatchCheckinPanel).
 */
function PendingInvitations({ clubId, formationId }: { clubId: string; formationId: FormationId | null }) {
  const { data: allInvitations, isLoading, isError, error, refetch } = useClubInvitations(clubId);
  const invitations = allInvitations?.filter((inv) => inv.status === "PENDING" && inv.slot_id !== null);
  const positionBySlotId = formationId
    ? new Map<string, PositionCode>(FORMATIONS[formationId].map((s) => [s.slotId, s.position]))
    : new Map<string, PositionCode>();

  return (
    <Card>
      <CardHeader>
        <CardTitle icon={<Mail size={18} color="#f4f5f7" />}>Invitations en attente</CardTitle>
        <Text className="text-sm text-fg-muted">{invitations?.length ?? 0}</Text>
      </CardHeader>
      {isLoading ? (
        <Skeleton className="h-16" />
      ) : isError ? (
        <ErrorState
          message={__DEV__ && error instanceof Error ? error.message : "Impossible de charger les invitations."}
          onRetry={refetch}
        />
      ) : !invitations || invitations.length === 0 ? (
        <Text className="text-sm text-fg-muted">Aucune invitation en attente.</Text>
      ) : (
        <View className="gap-2">
          {invitations.map((inv) => {
            const position = inv.slot_id ? positionBySlotId.get(inv.slot_id) : null;
            return (
              <View key={inv.id} className="flex-row items-center justify-between rounded-xl border border-border bg-bg-elevated p-2.5">
                <View>
                  <Text className="font-semibold text-fg">{inv.user?.username ?? "Joueur"}</Text>
                  <Text className="text-xs text-fg-subtle">{position ? POSITION_LABELS[position] : "Poste à définir"}</Text>
                </View>
                <Badge tone="warn">En attente</Badge>
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
}
