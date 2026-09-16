import { MyApplicationsList } from "@/components/player/MyApplicationsList";
import { AppShell } from "@/components/nav/AppShell";

/** Route stack inchangée (header natif via app/_layout.tsx) — contenu dans MyApplicationsList. */
export default function MyApplicationsScreen() {
  return (
    <AppShell>
      <MyApplicationsList />
    </AppShell>
  );
}
