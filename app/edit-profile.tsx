import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { EmptyState, ErrorState } from "@/components/ui/Screen";
import { Skeleton } from "@/components/ui/Skeleton";
import { EditProfileForm } from "@/components/profile/EditProfileForm";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useUserProfile } from "@/lib/hooks/useProfile";

/**
 * Édition de sa propre identité Pro Clubs (EA SPORTS FC 27) — champs déjà
 * posés à l'onboarding, UPDATE RLS `users_update_self`.
 */
export default function EditProfileScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const { data: user, isLoading, isError, refetch } = useUserProfile(userId);

  if (!userId) {
    return (
      <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 16 }}>
        <EmptyState title="Session requise pour modifier ton identité Pro Clubs." />
      </ScrollView>
    );
  }

  if (isLoading) {
    return (
      <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 16 }}>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-4 h-64" />
      </ScrollView>
    );
  }

  if (isError || !user) {
    return (
      <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 16 }}>
        <ErrorState message="Impossible de charger ton profil." onRetry={refetch} />
      </ScrollView>
    );
  }

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
      <Text className="mb-1 font-display text-2xl text-fg">Modifier mon identité</Text>
      <Text className="mb-4 text-sm text-fg-muted">
        EA SPORTS FC 27 Pro Clubs — les changements se reflètent sur ta ClubPro Card.
      </Text>
      <View className="w-full">
        <EditProfileForm user={user} onDone={() => router.back()} />
      </View>
    </ScrollView>
  );
}
