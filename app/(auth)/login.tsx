import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Gamepad2 } from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { supabase } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

/** Auth email/mot de passe via Supabase (section 1). */
export default function LoginScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          // URI natif déterministe, jamais via Linking.createURL() : en Dev
          // Client, createURL() incorpore le hostUri du serveur Metro
          // (ex: 127.0.0.1:8090) et produit une URL de callback invalide
          // (diagnostic précédent). Le scheme "clubproconnect" est fixe
          // (app.json > expo.scheme), donc une chaîne littérale est fiable
          // aussi bien en Dev Client qu'en build de production.
          options: { emailRedirectTo: "clubproconnect://auth/callback" },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      // La navigation vers onboarding/tabs est pilotée automatiquement par
      // le RootNavigator (voir app/_layout.tsx) via onAuthStateChange.
    } catch (err: any) {
      toast.error(err.message ?? "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 justify-center px-6">
        <View className="mb-10 items-center">
          <View className="mb-3 h-16 w-16 items-center justify-center rounded-3xl bg-accent/10">
            <Gamepad2 size={32} color="#39ff8a" />
          </View>
          <Text className="font-display text-4xl text-fg">
            Club<Text className="text-accent">Pro</Text> Connect
          </Text>
          <Text className="mt-1 text-sm text-fg-muted">Matchmaking temps réel pour Pro Clubs.</Text>
        </View>

        <View className="mb-5 flex-row rounded-2xl border border-border bg-bg-elevated p-1">
          <Pressable
            onPress={() => setMode("signin")}
            className={cn("flex-1 items-center rounded-xl py-3", mode === "signin" && "bg-accent")}
          >
            <Text className={cn("font-bold", mode === "signin" ? "text-bg" : "text-fg-muted")}>Connexion</Text>
          </Pressable>
          <Pressable
            onPress={() => setMode("signup")}
            className={cn("flex-1 items-center rounded-xl py-3", mode === "signup" && "bg-accent")}
          >
            <Text className={cn("font-bold", mode === "signup" ? "text-bg" : "text-fg-muted")}>Inscription</Text>
          </Pressable>
        </View>

        <View className="gap-4">
          <View>
            <Label>Email</Label>
            <Input
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
              placeholder="toi@exemple.com"
            />
          </View>
          <View>
            <Label>Mot de passe</Label>
            <Input
              secureTextEntry
              autoCapitalize="none"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
            />
          </View>

          <Button loading={loading} disabled={!email || password.length < 6} onPress={submit}>
            {mode === "signin" ? "Se connecter" : "Créer mon compte"}
          </Button>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
