import { ScrollView } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { ProfileContent } from "@/components/profile/ProfileContent";
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
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
      <ProfileContent userId={id} isOwn={isOwn} clubId={firstParam(clubId)} />
    </ScrollView>
  );
}
