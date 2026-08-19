import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Star, ThumbsDown, ThumbsUp } from "lucide-react-native";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { useSubmitReview } from "@/lib/hooks/useProfile";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

/** Check post-session Trust Engine : "présent / a lâché / bon esprit" (section 3.E). */
export function ReviewForm({ targetUserId }: { targetUserId: string }) {
  const [ratingSkill, setRatingSkill] = useState(3);
  const [ratingBehavior, setRatingBehavior] = useState(3);
  const [showedUp, setShowedUp] = useState<boolean | null>(null);
  const [comment, setComment] = useState("");
  const [done, setDone] = useState(false);
  const mutation = useSubmitReview(targetUserId);

  if (done) return null;

  const submit = () => {
    if (showedUp === null) {
      toast.error("Indique si le joueur était présent.");
      return;
    }
    mutation.mutate(
      { ratingSkill, ratingBehavior, showedUp, comment: comment.trim() || undefined },
      {
        onSuccess: () => {
          toast.success("Merci pour ton retour !");
          setDone(true);
        },
        onError: (err: any) => toast.error(err.message ?? "Erreur"),
      }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Noter ce joueur</CardTitle>
      </CardHeader>

      <View className="mb-3 flex-row gap-2">
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setShowedUp(true);
          }}
          className={cn("flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border py-2.5", showedUp === true ? "border-accent bg-accent/15" : "border-border")}
        >
          <ThumbsUp size={15} color={showedUp === true ? "#39ff8a" : "#9aa0a8"} />
          <Text className={cn("font-bold", showedUp === true ? "text-accent" : "text-fg-muted")}>Présent</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setShowedUp(false);
          }}
          className={cn("flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border py-2.5", showedUp === false ? "border-danger bg-danger/15" : "border-border")}
        >
          <ThumbsDown size={15} color={showedUp === false ? "#ff4d4f" : "#9aa0a8"} />
          <Text className={cn("font-bold", showedUp === false ? "text-danger" : "text-fg-muted")}>A lâché</Text>
        </Pressable>
      </View>

      <RatingRow label="Skill" value={ratingSkill} onChange={setRatingSkill} />
      <RatingRow label="Comportement" value={ratingBehavior} onChange={setRatingBehavior} />

      <Textarea
        placeholder="Commentaire (optionnel)"
        value={comment}
        onChangeText={setComment}
        maxLength={300}
        className="mt-2"
      />

      <View className="mt-3">
        <Button loading={mutation.isPending} onPress={submit}>
          Envoyer
        </Button>
      </View>
    </Card>
  );
}

function RatingRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <View className="mb-2 flex-row items-center justify-between">
      <Text className="text-sm text-fg-muted">{label}</Text>
      <View className="flex-row gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            hitSlop={6}
            onPress={() => {
              Haptics.selectionAsync();
              onChange(n);
            }}
          >
            <Star size={20} color="#39ff8a" fill={n <= value ? "#39ff8a" : "transparent"} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
