import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { Button } from "@/components/ui/Button";
import { cpcHex } from "@/lib/design/cpc-native";
import { useAuth } from "@/lib/providers/AuthProvider";
import {
  consumeParsedAuthCallback,
  destAfterEmailConfirm,
  parseAuthCallbackParams,
  parseAuthCallbackUrl,
  type ParsedAuthCallback,
} from "@/lib/auth/emailConfirm";

const SPINNER_MAX_MS = 10000;

/**
 * Deep link `clubproconnect://auth/callback` après Confirm signup Supabase.
 * Hors Stack.Protected : l'écran peut rester monté après exchange — on quitte
 * dès que `session` est posée, ou via le CTA, jamais un spinner infini.
 */
export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{
    code?: string;
    error?: string;
    error_description?: string;
    token_hash?: string;
    type?: string;
  }>();
  const router = useRouter();
  const { session, profile, refreshSession } = useAuth();
  const handledKey = useRef<string | null>(null);
  const [status, setStatus] = useState<"processing" | "ready" | "waiting" | "error">("processing");
  const [message, setMessage] = useState<string | null>(null);

  const leave = async () => {
    if (!session) {
      const next = await refreshSession();
      if (!next) {
        router.replace("/(auth)/login");
        return;
      }
    }
    router.replace(destAfterEmailConfirm(Boolean(profile)));
  };

  useEffect(() => {
    if (session) {
      setStatus("ready");
      void leave();
    }
    // leave captures router/profile — session flip is the trigger
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    if (session) return;
    const timer = setTimeout(() => {
      setStatus((current) => (current === "processing" ? "waiting" : current));
    }, SPINNER_MAX_MS);
    return () => clearTimeout(timer);
  }, [session]);

  useEffect(() => {
    let cancelled = false;

    const apply = async (parsed: ParsedAuthCallback) => {
      if (cancelled) return;
      if (parsed.kind === "error") {
        setStatus("error");
        setMessage(parsed.message);
        return;
      }
      if (parsed.kind === "empty") {
        setStatus((current) => (current === "processing" ? "waiting" : current));
        return;
      }
      const key = parsed.kind === "code" ? `code:${parsed.code}` : `otp:${parsed.tokenHash}`;
      if (handledKey.current === key) return;
      handledKey.current = key;
      setStatus("processing");
      const result = await consumeParsedAuthCallback(parsed);
      if (cancelled) return;
      if (result.ok) {
        setStatus("ready");
        return;
      }
      if (result.reason === "empty") {
        setStatus("waiting");
        return;
      }
      setStatus("error");
      setMessage(result.message ?? "Ce lien de confirmation n'est plus valide.");
    };

    const fromParams = parseAuthCallbackParams(params);
    if (fromParams.kind !== "empty") {
      void apply(fromParams);
      return () => {
        cancelled = true;
      };
    }

    Linking.getInitialURL()
      .then((url) => apply(parseAuthCallbackUrl(url)))
      .catch(() => {
        if (!cancelled) setStatus("waiting");
      });

    const sub = Linking.addEventListener("url", ({ url }) => {
      void apply(parseAuthCallbackUrl(url));
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
    // params object identity changes; primitive fields are the contract
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.code, params.error, params.error_description, params.token_hash, params.type]);

  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-bg px-8">
      {status === "processing" && !session ? (
        <View className="items-center">
          <ActivityIndicator color={cpcHex.accent} />
          <Text className="mt-4 text-center text-fg-muted">Confirmation en cours…</Text>
        </View>
      ) : status === "error" ? (
        <View className="w-full max-w-sm items-center gap-4">
          <Text className="text-center text-fg">
            {message ?? "Ce lien de confirmation n'est plus valide."}
          </Text>
          <Button className="w-full min-h-[44px]" onPress={() => router.replace("/(auth)/login")}>
            Retour à la connexion
          </Button>
        </View>
      ) : (
        <View className="w-full max-w-sm items-center gap-4">
          <Text className="text-center font-display text-xl text-fg">
            {session ? "Email confirmé" : "Tu as confirmé ?"}
          </Text>
          <Text className="text-center text-sm text-fg-muted">
            {session
              ? "On continue avec ton profil."
              : "Si tu as ouvert le lien dans l'email, continue — pas besoin de relancer l'app."}
          </Text>
          <Button className="w-full min-h-[44px]" onPress={leave}>
            Continuer
          </Button>
        </View>
      )}
    </SafeAreaView>
  );
}
