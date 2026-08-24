import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Badge } from "@/components/ui/Badge";
import { FORMATIONS, type FormationId, type FormationSlot } from "@/lib/formations";
import { POSITION_LABELS, type PositionCode } from "@/lib/constants";
import { canPressEmptyFormationSlot } from "@/lib/sessionState";
import type { SlotAssignmentRow } from "@/lib/types";

const SLOT_SIZE = 56;

/**
 * Terrain visuel réutilisable (owner ET joueur, lecture ou interaction selon
 * `interactive`). Les 11 slots viennent exclusivement de lib/formations.ts —
 * jamais de coordonnées codées ici : la formation reste l'unique source de
 * vérité structurelle (voir architecture validée, phase 1/2).
 */
export function FormationPitch({
  formationId,
  assignments,
  interactive = true,
  onEmptySlotPress,
  currentUserId = null,
  emptySlotHint = "Rechercher",
}: {
  formationId: FormationId;
  assignments: SlotAssignmentRow[];
  interactive?: boolean;
  /** Appelé au tap d'un slot vide (recherche côté owner, candidature côté joueur).
   *  Sans callback, le slot vide n'est pas tappable. */
  onEmptySlotPress?: (slot: FormationSlot) => void;
  /** Si fourni, le slot occupé par ce user est marqué "Vous" (Phase 4.6) —
   *  purement visuel, ne change aucune permission. */
  currentUserId?: string | null;
  /** Libellé sous un slot vide (Phase 5, Étape 3) — "Trouver un remplaçant"
   *  côté owner/manager, laissé au défaut générique sinon (le tap et le
   *  routing vers player-search restent strictement inchangés). */
  emptySlotHint?: string;
}) {
  const slots = FORMATIONS[formationId];
  const bySlot = new Map(assignments.map((a) => [a.slot_id, a]));

  return (
    <View
      className="w-full overflow-hidden rounded-2xl border border-border bg-[#0d2818]"
      style={{ aspectRatio: 0.72 }}
    >
      {/* Lignes de terrain minimalistes — pas d'asset graphique. */}
      <View className="absolute inset-4 rounded-lg border border-white/10" />
      <View className="absolute left-4 right-4 top-1/2 h-px bg-white/10" />
      <View
        className="absolute self-center rounded-full border border-white/10"
        style={{ top: "50%", width: 70, height: 70, marginTop: -35 }}
      />

      {slots.map((slot) => (
        <PitchSlot
          key={slot.slotId}
          slot={slot}
          occupant={bySlot.get(slot.slotId) ?? null}
          interactive={interactive}
          onEmptySlotPress={onEmptySlotPress}
          isYou={Boolean(currentUserId && bySlot.get(slot.slotId)?.user_id === currentUserId)}
          emptySlotHint={emptySlotHint}
        />
      ))}
    </View>
  );
}

function PitchSlot({
  slot,
  occupant,
  interactive,
  onEmptySlotPress,
  isYou,
  emptySlotHint,
}: {
  slot: FormationSlot;
  occupant: SlotAssignmentRow | null;
  interactive: boolean;
  onEmptySlotPress?: (slot: FormationSlot) => void;
  isYou: boolean;
  emptySlotHint: string;
}) {
  const positionLabel = POSITION_LABELS[slot.position as PositionCode] ?? slot.position;
  const isEmpty = !occupant?.user;

  // Foundation #2.1 — `interactive` ne gouverne QUE l'affordance de
  // recrutement/candidature d'un slot VIDE (Mode Joueur vs Mode Club). Un
  // slot OCCUPÉ reste toujours cliquable -> profil, quel que soit
  // `interactive` : sans ça, ClubHome (Mode Joueur, interactive=false)
  // perdrait le tap-vers-profil sur ses propres titulaires, ce qui n'est pas
  // la règle produit (seul le recrutement doit disparaître en Mode Joueur).
  // Sans handler, un slot vide n'est pas tappable (pas de toast « bientôt »).
  const canOpenEmpty = canPressEmptyFormationSlot(interactive, Boolean(onEmptySlotPress));
  const disabled = isEmpty && !canOpenEmpty;

  const onPress = () => {
    if (occupant?.user) {
      Haptics.selectionAsync();
      router.push(`/profile/${occupant.user_id}`);
      return;
    }
    if (!canOpenEmpty || !onEmptySlotPress) return;
    Haptics.selectionAsync();
    onEmptySlotPress(slot);
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="absolute items-center active:opacity-80"
      style={{
        left: `${slot.x}%`,
        top: `${slot.y}%`,
        width: SLOT_SIZE,
        marginLeft: -SLOT_SIZE / 2,
        marginTop: -SLOT_SIZE / 2 - 14,
      }}
    >
      {occupant?.user ? (
        <>
          <View className="h-14 w-14 items-center justify-center rounded-full border-2 border-accent bg-bg-elevated">
            <Text className="font-display text-lg text-accent">
              {occupant.user.username.slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <Text numberOfLines={1} className="mt-1 max-w-[72px] text-center text-[11px] font-bold text-fg">
            {occupant.user.username}
          </Text>
          <Text className="text-[10px] text-fg-subtle">{positionLabel}</Text>
          {isYou && <Badge tone="accent" className="mt-0.5 self-center px-1.5 py-0.5">Vous</Badge>}
        </>
      ) : canOpenEmpty ? (
        <>
          <View className="h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-white/30 bg-white/5">
            <Text className="text-lg font-bold text-white/50">+</Text>
          </View>
          <Text className="mt-1 text-[11px] font-bold text-white/80">{positionLabel}</Text>
          <Text className="text-[10px] text-white/40">{emptySlotHint}</Text>
        </>
      ) : (
        // Non-interactif (Mode Joueur, Foundation #2.1) : simple
        // représentation visuelle d'un poste vacant — pas de "+", pas
        // d'indice "Rechercher", aucune affordance de recrutement.
        <>
          <View className="h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/5" />
          <Text className="mt-1 text-[11px] font-bold text-white/50">{positionLabel}</Text>
        </>
      )}
    </Pressable>
  );
}
