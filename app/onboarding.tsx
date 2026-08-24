import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MotiView } from "moti";
import * as Haptics from "expo-haptics";
import { ChevronLeft } from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { ChipSelect } from "@/components/ui/ChipSelect";
import {
  LANGUAGES, LANGUAGE_LABELS, PLATFORMS, PLATFORM_LABELS,
  PLAY_STYLES, PLAY_STYLE_LABELS, POSITIONS, POSITION_LABELS,
} from "@/lib/constants";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/providers/AuthProvider";
import { toast } from "@/lib/toast";

const AVAILABILITY_OPTIONS = [
  { value: "weekday_evening", label: "Soir en semaine" },
  { value: "weekend", label: "Week-end" },
  { value: "daytime", label: "Journée" },
  { value: "late_night", label: "Tard le soir" },
];

const TOTAL_STEPS = 6;

/**
 * Onboarding en étapes courtes (section 1) : username -> plateforme -> poste
 * principal + postes secondaires -> style de jeu -> langue -> dispo.
 * Chaque étape est volontairement minimale pour rester sous 10s.
 */
export default function OnboardingScreen() {
  const { session, refreshProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [username, setUsername] = useState("");
  const [platform, setPlatform] = useState("");
  const [mainPosition, setMainPosition] = useState("");
  const [secondaryPositions, setSecondaryPositions] = useState<string[]>([]);
  const [playStyle, setPlayStyle] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [availability, setAvailability] = useState<string[]>([]);

  const canNext = [
    username.trim().length >= 3,
    platform !== "",
    mainPosition !== "",
    playStyle !== "",
    languages.length > 0,
    true,
  ][step];

  const next = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  };
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const submit = async () => {
    if (!session) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("users").upsert({
        id: session.user.id,
        username: username.trim(),
        platform,
        main_position: mainPosition,
        secondary_positions: secondaryPositions,
        play_style: playStyle,
        languages,
        availability: { slots: availability },
      });
      if (error) throw error;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success("Profil créé ! Bienvenue sur ClubPro Connect.");
      await refreshProfile();
    } catch (err: any) {
      toast.error(err.message?.includes("duplicate") ? "Ce username est déjà pris." : err.message ?? "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-bg px-6">
      <View className="mt-2 flex-row items-center gap-3">
        {step > 0 && (
          <Pressable onPress={back} hitSlop={12}>
            <ChevronLeft size={22} color="#9aa0a8" />
          </Pressable>
        )}
        <View className="flex-1 flex-row gap-1">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-accent" : "bg-bg-elevated"}`} />
          ))}
        </View>
      </View>

      <View className="flex-1 justify-center">
        <MotiView key={step} from={{ opacity: 0, translateX: 12 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: "timing", duration: 250 }}>
          {step === 0 && (
            <Step title="Choisis ton username" subtitle="Ton pseudo Pro Clubs sur ClubPro Connect (EA SPORTS FC 27).">
              <Label>Username</Label>
              <Input autoFocus autoCapitalize="none" value={username} onChangeText={setUsername} placeholder="ex: xX_Striker_Xx" />
            </Step>
          )}
          {step === 1 && (
            <Step title="Ta plateforme" subtitle="Là où tu joues à EA SPORTS FC 27 Pro Clubs.">
              <ChipSelect single value={platform ? [platform] : []} onChange={(v) => setPlatform(v[0])} options={PLATFORMS.map((p) => ({ value: p, label: PLATFORM_LABELS[p] }))} />
            </Step>
          )}
          {step === 2 && (
            <Step title="Tes postes" subtitle="1 poste principal, jusqu'à 2 postes secondaires.">
              <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-fg-muted">Poste principal</Text>
              <ChipSelect single value={mainPosition ? [mainPosition] : []} onChange={(v) => setMainPosition(v[0])} options={POSITIONS.map((p) => ({ value: p, label: POSITION_LABELS[p] }))} />
              <Text className="mb-2 mt-4 text-xs font-bold uppercase tracking-wide text-fg-muted">Postes secondaires (optionnel)</Text>
              <ChipSelect max={2} value={secondaryPositions} onChange={setSecondaryPositions} options={POSITIONS.filter((p) => p !== mainPosition).map((p) => ({ value: p, label: POSITION_LABELS[p] }))} />
            </Step>
          )}
          {step === 3 && (
            <Step title="Ton style de jeu" subtitle="Comment tu joues en Pro Clubs FC 27.">
              <ChipSelect single value={playStyle ? [playStyle] : []} onChange={(v) => setPlayStyle(v[0])} options={PLAY_STYLES.map((p) => ({ value: p, label: PLAY_STYLE_LABELS[p] }))} />
            </Step>
          )}
          {step === 4 && (
            <Step title="Tes langues" subtitle="Pour matcher avec des clubs qui te comprennent.">
              <ChipSelect value={languages} onChange={setLanguages} options={LANGUAGES.map((l) => ({ value: l, label: LANGUAGE_LABELS[l] }))} />
            </Step>
          )}
          {step === 5 && (
            <Step title="Tes disponibilités" subtitle="Quand tu es dispo pour une session Pro Clubs (optionnel).">
              <ChipSelect value={availability} onChange={setAvailability} options={AVAILABILITY_OPTIONS} />
            </Step>
          )}
        </MotiView>
      </View>

      <View className="mb-4">
        {step < TOTAL_STEPS - 1 ? (
          <Button disabled={!canNext} onPress={next}>Continuer</Button>
        ) : (
          <Button loading={submitting} onPress={submit}>Terminer et rejoindre ClubPro Connect</Button>
        )}
      </View>
    </SafeAreaView>
  );
}

function Step({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <View>
      <Text className="font-display text-3xl text-fg">{title}</Text>
      <Text className="mb-5 mt-1 text-sm text-fg-muted">{subtitle}</Text>
      {children}
    </View>
  );
}
