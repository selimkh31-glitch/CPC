import { MyInvitationsList } from "@/components/player/MyInvitationsList";
import { AppShell } from "@/components/nav/AppShell";

/** Route stack inchangée (header natif via app/_layout.tsx) — contenu dans MyInvitationsList. */
export default function MyInvitationsScreen() {
  return (
    <AppShell>
      <MyInvitationsList />
    </AppShell>
  );
}
