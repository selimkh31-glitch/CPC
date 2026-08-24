import type { NotificationRow } from "@/lib/types";

/** Nombre de lignes encore non lues (`read_at` null) — même dérivation que le badge Activité. */
export function unreadNotificationCount(items: NotificationRow[]): number {
  return items.filter((n) => n.read_at == null).length;
}

/**
 * Miroir cache du UPDATE RLS `read_at` sur toutes les non-lues.
 * Ne touche pas aux lignes déjà lues, n'ajoute aucune ligne.
 */
export function withAllNotificationsRead(items: NotificationRow[], readAt: string): NotificationRow[] {
  return items.map((n) => (n.read_at == null ? { ...n, read_at: readAt } : n));
}
