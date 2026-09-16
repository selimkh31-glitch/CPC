import { useLocalSearchParams } from "expo-router";
import { ProfileContent } from "@/components/profile/ProfileContent";
import { AppShell } from "@/components/nav/AppShell";
import { useAuth } from "@/lib/providers/AuthProvider";

function firstParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string" && value.trim()) return value;
  if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim()) return value[0];
  return null;
}

export default function OtherProfileScreen() {
  const { id, clubId } = useLocalSearchParams<{ id: string; clubId?: string | string[] }>();
  const { session } = useAuth();
  const isOwn = session?.user.id === id;

  return (
    <AppShell>
      <ProfileContent userId={id} isOwn={isOwn} clubId={firstParam(clubId)} />
    </AppShell>
  );
}
