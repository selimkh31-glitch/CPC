import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase/client";
import { callEdgeFunction } from "@/lib/api/edge";
import { USER_PUBLIC_COLUMNS, type ConversationRow, type MessageRow } from "@/lib/types";
import { fetchBlockedUserIdSet } from "@/lib/hooks/useSafety";
import { filterVisibleConversations } from "@/lib/social";

export { getDirectConversationPeer } from "@/lib/social";

/**
 * Chat — fondation (mission "CHAT — VRAIE FONDATION", section 11).
 * Toute écriture de message passe par un INSERT client direct (RLS
 * `messages_insert_member` dérive `sender_id` du JWT — voir
 * supabase/migrations/0017_chat_rls.sql), même convention que
 * club_sessions/reviews pour les mutations "simples". Seule la CRÉATION
 * d'une conversation DIRECT (dédoublonnage) passe par une Edge Function
 * (start-direct-conversation), trop multi-étapes pour du RLS seul. Type
 * CLUB : get-or-create via start-club-conversation (0028), même fil
 * `/conversation/[id]`.
 *
 * Pagination (section 30) : `useMessages` charge les MESSAGES_PAGE_SIZE
 * derniers messages ; `useLoadOlderMessages` fusionne une page plus
 * ancienne en tête du cache local — jamais de chargement de l'historique
 * complet d'un coup.
 */
const MESSAGES_PAGE_SIZE = 30;

/** Membres (peer DIRECT) + groupe (titre GROUP) + club (titre CLUB). */
const CONVERSATION_SELECT = `*, members:conversation_members(*, user:users(${USER_PUBLIC_COLUMNS})), group:groups(id,name), club:clubs(id,name)`;

function firstEmbed<T>(raw: T | T[] | null | undefined): T | null {
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw ?? null;
}

function hydrateConversationEmbeds(row: ConversationRow): ConversationRow {
  return {
    ...row,
    group: firstEmbed(row.group as ConversationRow["group"] | NonNullable<ConversationRow["group"]>[] | null | undefined),
    club: firstEmbed(row.club as ConversationRow["club"] | NonNullable<ConversationRow["club"]>[] | null | undefined),
  };
}

/** Conversations dont l'utilisateur connecté est membre (les plus récentes en premier). */
export function useConversations(userId: string | null) {
  return useQuery({
    queryKey: ["conversations", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      // Deux requêtes plutôt qu'une jointure directe conversations->members :
      // la RLS de `conversations` exige déjà d'être membre (auto-jointure
      // conversation_members), une jointure PostgREST imbriquée sur la même
      // table filtrée par user_id ici serait ambiguë. Ordre de grandeur du
      // nombre de conversations par joueur très faible (pas un souci de perf).
      const { data: memberships, error: membershipsError } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", userId!);
      if (membershipsError) throw membershipsError;

      const conversationIds = (memberships ?? []).map((m) => m.conversation_id);
      if (conversationIds.length === 0) return [] as ConversationRow[];

      const { data, error } = await supabase
        .from("conversations")
        .select(CONVERSATION_SELECT)
        .in("id", conversationIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      let blocked: Set<string>;
      try {
        blocked = await fetchBlockedUserIdSet();
      } catch {
        blocked = new Set();
      }
      const rows = ((data ?? []) as ConversationRow[]).map(hydrateConversationEmbeds);
      return filterVisibleConversations(rows, userId!, blocked);
    },
  });
}

/** Une conversation (membres inclus) — pour titre + état bloqué du fil, sans filtrer. */
export function useConversation(conversationId: string | null) {
  return useQuery({
    queryKey: ["conversation", conversationId],
    enabled: Boolean(conversationId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select(CONVERSATION_SELECT)
        .eq("id", conversationId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return hydrateConversationEmbeds(data as ConversationRow);
    },
  });
}

/** Démarre (ou retrouve) une conversation DIRECT avec `otherUserId` — voir start-direct-conversation. */
export function useStartDirectConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (otherUserId: string) =>
      callEdgeFunction<{ conversation: ConversationRow }>("start-direct-conversation", { otherUserId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["conversation"] });
    },
    onError: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  });
}

/** Ouvre (ou retrouve) la conversation CLUB du club — voir start-club-conversation / 0028. */
export function useStartClubConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (clubId: string) =>
      callEdgeFunction<{ conversation: ConversationRow }>("start-club-conversation", { clubId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["conversation"] });
    },
    onError: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  });
}

/**
 * Registre module-level des canaux `messages-${conversationId}` — même
 * nécessité et même doctrine que myInvitationsChannels/clubDeparturesChannels
 * (lib/hooks/useInvitations.ts, lib/hooks/useDepartures.ts) : réutilisation
 * par référence-comptage pour éviter le crash Realtime "cannot add
 * postgres_changes callbacks ... after subscribe()" si un même fil de
 * discussion est monté par deux composants en même temps.
 */
const messageChannels = new Map<
  string,
  { channel: ReturnType<typeof supabase.channel>; listeners: Set<() => void>; refCount: number }
>();

function acquireMessagesChannel(conversationId: string) {
  let entry = messageChannels.get(conversationId);
  if (!entry) {
    const listeners = new Set<() => void>();
    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        // "*" (pas seulement INSERT) — audit post-session : un edit ou un
        // soft-delete (UPDATE body/edited_at/deleted_at, voir
        // messages_update_own) ne se propageait pas en temps réel aux
        // autres membres de la conversation tant que l'écoute était
        // restreinte à INSERT. Coût négligeable (une invalidation
        // supplémentaire, idempotente) pour un vrai correctif de section 11
        // ("édition", "soft delete").
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        () => listeners.forEach((listener) => listener())
      )
      .subscribe();
    entry = { channel, listeners, refCount: 0 };
    messageChannels.set(conversationId, entry);
  }
  entry.refCount += 1;
  return entry;
}

function releaseMessagesChannel(conversationId: string, listener: () => void) {
  const entry = messageChannels.get(conversationId);
  if (!entry) return;
  entry.listeners.delete(listener);
  entry.refCount -= 1;
  if (entry.refCount <= 0) {
    supabase.removeChannel(entry.channel);
    messageChannels.delete(conversationId);
  }
}

/** Les MESSAGES_PAGE_SIZE derniers messages d'une conversation, ordre chronologique croissant, temps réel inclus. */
export function useMessages(conversationId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["messages", conversationId],
    enabled: Boolean(conversationId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select(`*, sender:users(${USER_PUBLIC_COLUMNS})`)
        .eq("conversation_id", conversationId!)
        .order("created_at", { ascending: false })
        .limit(MESSAGES_PAGE_SIZE);
      if (error) throw error;
      return (data as MessageRow[]).slice().reverse();
    },
  });

  useEffect(() => {
    if (!conversationId) return;
    // Un nouveau message (le nôtre inclus, réémis par Postgres) -> simple
    // invalidation plutôt qu'un merge manuel du payload realtime : reste
    // correct même en cas d'edit/soft-delete concurrent, coût négligeable
    // vu le volume par conversation.
    const listener = () => queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
    const entry = acquireMessagesChannel(conversationId);
    entry.listeners.add(listener);
    return () => releaseMessagesChannel(conversationId, listener);
  }, [conversationId, queryClient]);

  return query;
}

/** Section 30 — charge une page plus ancienne et la fusionne en tête du cache local. */
export function useLoadOlderMessages(conversationId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const current = queryClient.getQueryData<MessageRow[]>(["messages", conversationId]);
      const oldest = current?.[0];
      if (!oldest) return [] as MessageRow[];
      const { data, error } = await supabase
        .from("messages")
        .select(`*, sender:users(${USER_PUBLIC_COLUMNS})`)
        .eq("conversation_id", conversationId!)
        .lt("created_at", oldest.created_at)
        .order("created_at", { ascending: false })
        .limit(MESSAGES_PAGE_SIZE);
      if (error) throw error;
      return (data as MessageRow[]).slice().reverse();
    },
    onSuccess: (olderMessages) => {
      if (olderMessages.length === 0) return;
      queryClient.setQueryData<MessageRow[]>(["messages", conversationId], (old) => [...olderMessages, ...(old ?? [])]);
    },
  });
}

/** Envoi direct (RLS dérive/valide sender_id + membership — voir en-tête). */
export function useSendMessage(conversationId: string, senderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      const { data, error } = await supabase
        .from("messages")
        .insert({ conversation_id: conversationId, sender_id: senderId, body })
        .select(`*, sender:users(${USER_PUBLIC_COLUMNS})`)
        .single();
      if (error) {
        if (typeof error.message === "string" && error.message.includes("users_blocked")) {
          throw new Error("Tu ne peux pas interagir avec ce joueur.");
        }
        throw error;
      }
      const message = data as MessageRow;
      // Notif in-app (RPC create_notification via Edge) : l'INSERT client
      // reste le send path ; un échec notify ne rollback pas le message.
      void callEdgeFunction("notify-message-received", { messageId: message.id }).catch((err) => {
        console.warn("[notify-message-received]", err);
      });
      return message;
    },
    onSuccess: (message) => {
      queryClient.setQueryData<MessageRow[]>(["messages", conversationId], (old) => (old ? [...old, message] : [message]));
    },
    onError: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  });
}

/** Marque la conversation comme lue jusqu'à maintenant (colonne last_read_at, grant restreint — voir migration). */
export function useMarkConversationRead(conversationId: string, userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("conversation_members")
        .update({ last_read_at: new Date().toISOString() })
        .eq("conversation_id", conversationId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["conversations"] }),
  });
}
