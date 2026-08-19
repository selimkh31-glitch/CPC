import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { supabase } from "@/lib/supabase/client";
import { secureStoreAdapter } from "@/lib/supabase/secureStoreAdapter";

/**
 * Cible du deep link clubproconnect://auth/callback envoyé par Supabase après
 * confirmation d'email (flow PKCE, voir lib/supabase/client.ts). Route hors de
 * tout Stack.Protected (app/_layout.tsx) pour rester accessible avant qu'une
 * session existe, que l'app soit froide ou déjà ouverte.
 *
 * Une fois exchangeCodeForSession() réussi, AuthProvider.onAuthStateChange
 * (lib/providers/AuthProvider.tsx) détecte la nouvelle session et le
 * RootNavigator bascule automatiquement vers onboarding/tabs — pas de
 * navigation manuelle nécessaire pour la redirection finale, seulement pour
 * quitter cet écran une fois la session posée.
 *
 * DIAGNOSTIC TEMPORAIRE (à retirer après investigation) : logs booléens
 * uniquement, aucune valeur sensible (code, verifier, tokens) n'est jamais
 * affichée — voir chaque console.log ci-dessous.
 */
export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{
    code?: string;
    error?: string;
    error_description?: string;
  }>();
  const { code, error, error_description } = params;
  const router = useRouter();
  const handledCode = useRef<string | null>(null);
  const [status, setStatus] = useState<"processing" | "error">("processing");
  const [caughtMessage, setCaughtMessage] = useState<string | null>(null);

  // --- DIAGNOSTIC TEMPORAIRE : montage + forme de l'URL reçue ---
  useEffect(() => {
    console.log("[AUTH CALLBACK] mounted");
    console.log("[AUTH CALLBACK] pathname: /auth/callback");
    console.log("[AUTH CALLBACK] query keys:", Object.keys(params));
    console.log("[AUTH CALLBACK] code present:", Boolean(code));
    console.log("[AUTH CALLBACK] error present:", Boolean(error));
    console.log("[AUTH CALLBACK] error_description present:", Boolean(error_description));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- DIAGNOSTIC TEMPORAIRE : présence du code_verifier PKCE en storage ---
  useEffect(() => {
    const storageKey = (supabase.auth as unknown as { storageKey: string }).storageKey;
    secureStoreAdapter
      .getItem(`${storageKey}-code-verifier`)
      .then((verifier) => {
        console.log("[AUTH CALLBACK] PKCE verifier present:", verifier != null);
      })
      .catch((err: unknown) => {
        console.log("[AUTH CALLBACK] PKCE verifier check threw:", err instanceof Error ? err.message : String(err));
      });
  }, []);

  useEffect(() => {
    Linking.clearInitialURL();
  }, []);

  useEffect(() => {
    if (error) {
      setStatus("error");
      return;
    }

    if (!code || handledCode.current === code) return;
    handledCode.current = code;

    // --- DIAGNOSTIC TEMPORAIRE : timeout d'observation (ne coupe rien) ---
    let settled = false;
    const timeoutId = setTimeout(() => {
      if (!settled) console.log("[AUTH CALLBACK] exchange timeout (still pending after 15s)");
    }, 15000);

    console.log("[AUTH CALLBACK] starting exchange");

    supabase.auth
      .exchangeCodeForSession(code)
      .then(({ data, error: exchangeError }) => {
        settled = true;
        clearTimeout(timeoutId);
        console.log("[AUTH CALLBACK] exchange returned");
        console.log("[AUTH CALLBACK] session present:", Boolean(data?.session));
        console.log("[AUTH CALLBACK] error present:", Boolean(exchangeError));
        if (exchangeError) {
          console.log("[AUTH CALLBACK] error message:", exchangeError.message);
          setStatus("error");
          setCaughtMessage(exchangeError.message);
          return;
        }
        // "/" résout vers Mode Joueur (Foundation #1 : le mode démarre
        // toujours à PLAYER, voir AppModeProvider) via le Stack.Protected
        // d'app/_layout.tsx ; si le profil n'existe pas encore (première
        // confirmation d'email), ce même guard redirige automatiquement vers
        // /onboarding — même mécanisme que app/(auth)/login.tsx, qui ne
        // navigue jamais manuellement non plus.
        console.log("[AUTH CALLBACK] navigating to /");
        router.replace("/");
        console.log("[AUTH CALLBACK] navigation call completed");
      })
      .catch((err: unknown) => {
        settled = true;
        clearTimeout(timeoutId);
        // exchangeCodeForSession peut rejeter (réseau, etc.) plutôt que
        // résoudre avec { error } — sans ce catch, l'écran restait bloqué en
        // "processing" indéfiniment et l'échec restait invisible.
        console.log("[AUTH CALLBACK] exchange threw");
        console.log("[AUTH CALLBACK] error message:", err instanceof Error ? err.message : String(err));
        setStatus("error");
        setCaughtMessage(err instanceof Error ? err.message : "Erreur réseau inattendue.");
      });
  }, [code, error, router]);

  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-bg px-8">
      {status === "processing" ? (
        <>
          <ActivityIndicator color="#39ff8a" />
          <Text className="mt-4 text-center text-fg-muted">Confirmation en cours…</Text>
        </>
      ) : (
        <View className="items-center gap-4">
          <Text className="text-center text-fg">
            {error_description ?? caughtMessage ?? "Ce lien de confirmation n'est plus valide."}
          </Text>
          <Pressable onPress={() => router.replace("/(auth)/login")} className="rounded-xl bg-accent px-5 py-3">
            <Text className="font-bold text-bg">Retour à la connexion</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}
