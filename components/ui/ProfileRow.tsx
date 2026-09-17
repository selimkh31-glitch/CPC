import { Pressable, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { Avatar } from "@/components/ui/Avatar";
import { cpcHex } from "@/lib/design/cpc-native";
import { cpcTokens } from "@/lib/design/cpc-tokens";
import { cn } from "@/lib/utils";

export function ProfileRow({
  name,
  meta,
  onPress,
  className,
}: {
  name: string;
  meta?: string;
  onPress?: () => void;
  className?: string;
}) {
  const body = (
    <View className={cn("min-h-[44px] flex-row items-center gap-3 py-2", className)}>
      <Avatar username={name} size="sm" />
      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className="font-sans-semibold text-body text-fg" style={{ color: cpcHex.textPrimary }}>
          {name}
        </Text>
        {meta ? (
          <Text numberOfLines={1} className="mt-0.5 font-sans text-caption text-fg-muted" style={{ color: cpcHex.textMuted }}>
            {meta}
          </Text>
        ) : null}
      </View>
      {onPress ? <ChevronRight size={cpcTokens.icon.sm} color={cpcHex.textMuted} /> : null}
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={name}>
      {body}
    </Pressable>
  );
}
