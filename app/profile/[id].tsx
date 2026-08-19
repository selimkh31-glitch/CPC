import { ScrollView } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { ProfileContent } from "@/components/profile/ProfileContent";
import { useAuth } from "@/lib/providers/AuthProvider";

export default function OtherProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const isOwn = session?.user.id === id;

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
      <ProfileContent userId={id} isOwn={isOwn} />
    </ScrollView>
  );
}
