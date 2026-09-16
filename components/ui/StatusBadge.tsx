import { View, Text } from "react-native";
import { AlertTriangle, Check, Clock, Minus, X } from "lucide-react-native";
import { cn } from "@/lib/utils";
import { cpcTokens, type CpcStatus } from "@/lib/design/cpc-tokens";
import { cpcStatusColor } from "@/lib/design/cpc-native";

const ICONS = {
  pulse: Clock,
  check: Check,
  alert: AlertTriangle,
  clock: Clock,
  x: X,
  minus: Minus,
} as const;

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: CpcStatus;
  label?: string;
  className?: string;
}) {
  const meta = cpcTokens.status[status];
  const color = cpcStatusColor[status];
  const Icon = ICONS[meta.icon];
  const text = label ?? meta.label;

  return (
    <View
      className={cn("flex-row items-center gap-1 self-start border px-2 py-1", className)}
      style={{ borderRadius: cpcTokens.radius.badge, borderColor: `${color}66`, backgroundColor: `${color}1A` }}
      accessibilityRole="text"
      accessibilityLabel={text}
    >
      <Icon size={cpcTokens.icon.xs} color={color} />
      <Text className="font-sans-bold text-caption" style={{ color }}>
        {text}
      </Text>
    </View>
  );
}
