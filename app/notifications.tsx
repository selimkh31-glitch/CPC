import { NotificationsList } from "@/components/player/NotificationsList";
import { AppShell } from "@/components/nav/AppShell";

/** Route stack inchangée (header natif via app/_layout.tsx) — contenu dans NotificationsList. */
export default function NotificationsScreen() {
  return (
    <AppShell>
      <NotificationsList />
    </AppShell>
  );
}
