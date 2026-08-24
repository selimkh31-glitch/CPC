import "@/global.css";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import {
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
} from "@expo-google-fonts/barlow-condensed";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { queryClient } from "@/lib/queryClient";
import { AuthProvider, useAuth } from "@/lib/providers/AuthProvider";
import { AppModeProvider, useAppMode } from "@/lib/providers/AppModeProvider";
import { ToastHost } from "@/components/ui/ToastHost";
import { useBlockedUserIds } from "@/lib/hooks/useSafety";
import { useNotifications } from "@/lib/hooks/useNotifications";

SplashScreen.preventAutoHideAsync().catch(() => {});

/** Canaux Realtime block/notifications (ref-countés) dès qu'une session existe. */
function SafetyRealtimeBridge() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  useBlockedUserIds(userId);
  useNotifications(userId);
  return null;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {/* Foundation #1 — AppModeProvider À L'INTÉRIEUR d'AuthProvider :
              il a besoin de useAuth() pour se réinitialiser sur changement de
              session (voir AppModeProvider.tsx). */}
          <AppModeProvider>
            <SafeAreaProvider>
              <StatusBar style="light" />
              <SafetyRealtimeBridge />
              <RootNavigator />
              <ToastHost />
            </SafeAreaProvider>
          </AppModeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Auth guard (section 1) : redirige session absente -> (auth), session sans
 * profil -> onboarding, session + profil -> tabs. `Stack.Protected` ne monte
 * que le groupe de routes correspondant à l'état courant.
 */
function RootNavigator() {
  const { session, profile, profileError, loading, refreshProfile } = useAuth();
  const { mode } = useAppMode();
  const [retrying, setRetrying] = useState(false);

  if (loading) {
    return <View className="flex-1 bg-bg" />;
  }

  // Échec réseau/RLS lors du chargement du profil : ne jamais rediriger vers
  // l'onboarding à tort (voir AuthProvider.fetchProfile) — on bloque ici avec
  // une action de retry explicite plutôt qu'un skeleton indéfini.
  if (session && !profile && profileError) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-bg px-8">
        <Text className="text-center text-fg">Impossible de charger ton profil.</Text>
        <Text className="text-center text-sm text-fg-muted">Vérifie ta connexion, puis réessaie.</Text>
        <Pressable
          disabled={retrying}
          onPress={async () => {
            setRetrying(true);
            await refreshProfile();
            setRetrying(false);
          }}
          className="rounded-xl bg-accent px-5 py-3"
        >
          {retrying ? <ActivityIndicator color="#08090b" /> : <Text className="font-bold text-bg">Réessayer</Text>}
        </Pressable>
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#08090b" } }}>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>

      <Stack.Protected guard={Boolean(session) && !profile}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>

      {/* Foundation #1 — deux arbres de mode distincts, jamais montés en même
          temps : le guard AND (session ET profil ET mode) remplace l'ancien
          groupe unique "(tabs)". Le switch (ModeSwitch) ne fait QUE changer
          `mode` — c'est ce guard, pas une navigation impérative, qui décide
          quel arbre est monté (même principe que le guard d'auth ci-dessus). */}
      <Stack.Protected guard={Boolean(session) && Boolean(profile) && mode === "PLAYER"}>
        <Stack.Screen name="(player)" />
      </Stack.Protected>

      <Stack.Protected guard={Boolean(session) && Boolean(profile) && mode === "CLUB"}>
        <Stack.Screen name="(club)" />
      </Stack.Protected>

      {/* Écrans partagés, indépendants du mode actif (deep links historiques
          conservés — voir app/dashboard.tsx pour le shim /dashboard?clubId=X). */}
      <Stack.Protected guard={Boolean(session) && Boolean(profile)}>
        <Stack.Screen
          name="club/[id]"
          options={{ headerShown: true, headerStyle: { backgroundColor: "#08090b" }, headerTintColor: "#f4f5f7", headerTitle: "" }}
        />
        <Stack.Screen
          name="profile/[id]"
          options={{ headerShown: true, headerStyle: { backgroundColor: "#08090b" }, headerTintColor: "#f4f5f7", headerTitle: "" }}
        />
        <Stack.Screen
          name="dashboard"
          options={{ headerShown: true, headerStyle: { backgroundColor: "#08090b" }, headerTintColor: "#f4f5f7", title: "Mon club" }}
        />
        <Stack.Screen
          name="create-club"
          options={{ headerShown: true, headerStyle: { backgroundColor: "#08090b" }, headerTintColor: "#f4f5f7", title: "Créer un club" }}
        />
        <Stack.Screen
          name="my-applications"
          options={{ headerShown: true, headerStyle: { backgroundColor: "#08090b" }, headerTintColor: "#f4f5f7", title: "Mes candidatures" }}
        />
        <Stack.Screen
          name="match-sheet"
          options={{ headerShown: true, headerStyle: { backgroundColor: "#08090b" }, headerTintColor: "#f4f5f7", title: "Feuille de match" }}
        />
        <Stack.Screen
          name="player-search"
          options={{ headerShown: true, headerStyle: { backgroundColor: "#08090b" }, headerTintColor: "#f4f5f7", title: "Rechercher un joueur" }}
        />
        <Stack.Screen
          name="find-club"
          options={{ headerShown: true, headerStyle: { backgroundColor: "#08090b" }, headerTintColor: "#f4f5f7", title: "Trouver un club" }}
        />
        <Stack.Screen
          name="my-invitations"
          options={{ headerShown: true, headerStyle: { backgroundColor: "#08090b" }, headerTintColor: "#f4f5f7", title: "Mes invitations" }}
        />
        <Stack.Screen
          name="pricing"
          options={{ presentation: "modal", headerShown: true, headerStyle: { backgroundColor: "#08090b" }, headerTintColor: "#f4f5f7", title: "Passer Pro" }}
        />
        {/* Social Foundations — Chat (mission section 11). Aucun point d'entrée
            dans une tab bar (voir mission section 37) : accessible via
            router.push, notamment depuis le bouton "Message" du profil joueur. */}
        <Stack.Screen
          name="conversations"
          options={{ headerShown: true, headerStyle: { backgroundColor: "#08090b" }, headerTintColor: "#f4f5f7", title: "Messages" }}
        />
        <Stack.Screen
          name="conversation/[id]"
          options={{ headerShown: true, headerStyle: { backgroundColor: "#08090b" }, headerTintColor: "#f4f5f7", headerTitle: "" }}
        />
        {/* Social Foundations — Groupes (mission section 12). Même doctrine
            que Chat ci-dessus : pas d'entrée dans une tab bar, accessible via
            router.push depuis le raccourci "Groupes" de l'onglet Profil. */}
        <Stack.Screen
          name="groups"
          options={{ headerShown: true, headerStyle: { backgroundColor: "#08090b" }, headerTintColor: "#f4f5f7", title: "Groupes" }}
        />
        <Stack.Screen
          name="group/[id]"
          options={{ headerShown: true, headerStyle: { backgroundColor: "#08090b" }, headerTintColor: "#f4f5f7", headerTitle: "" }}
        />
        <Stack.Screen
          name="notifications"
          options={{ headerShown: true, headerStyle: { backgroundColor: "#08090b" }, headerTintColor: "#f4f5f7", title: "Notifications" }}
        />
        <Stack.Screen
          name="blocked"
          options={{ headerShown: true, headerStyle: { backgroundColor: "#08090b" }, headerTintColor: "#f4f5f7", title: "Bloqués" }}
        />
        <Stack.Screen
          name="report/[userId]"
          options={{ headerShown: true, headerStyle: { backgroundColor: "#08090b" }, headerTintColor: "#f4f5f7", title: "Signaler" }}
        />
      </Stack.Protected>

      {/* Hors de tout Stack.Protected : accessible sans session (deep link
          de confirmation email, avant ou après connexion). Volontairement
          déclaré après les groupes ci-dessus pour ne jamais être routeNames[0]
          (voir StackRouter : initialRouteName ?? routeNames[0]) — sinon cet
          écran devient la route de démarrage par défaut à chaque lancement. */}
      <Stack.Screen name="auth/callback" />
    </Stack>
  );
}
