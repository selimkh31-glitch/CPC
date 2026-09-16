import { LiveBadge } from "@/components/ui/LiveBadge";
import { cn } from "@/lib/utils";

/**
 * Badge LIVE — libellé « LIVE » + point pulsé (couleur live, pas seulement le vert).
 */
export function LiveIndicator({ className }: { className?: string }) {
  return <LiveBadge className={cn(className)} />;
}
