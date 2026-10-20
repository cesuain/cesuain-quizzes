import {
  Atom,
  BadgeCheck,
  Blocks,
  BookOpenCheck,
  Compass,
  Crosshair,
  Crown,
  Flame,
  Footprints,
  GraduationCap,
  Layers,
  Lightbulb,
  Medal,
  Rocket,
  Search,
  Target,
  Trophy,
  Zap,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";
import { createElement } from "react";
import type { AchievementIconName } from "@/lib/achievements/catalog";

export const ACHIEVEMENT_ICON_COMPONENTS: Record<AchievementIconName, LucideIcon> = {
  footprints: Footprints,
  compass: Compass,
  "book-open-check": BookOpenCheck,
  crown: Crown,
  "badge-check": BadgeCheck,
  layers: Layers,
  atom: Atom,
  zap: Zap,
  flame: Flame,
  rocket: Rocket,
  lightbulb: Lightbulb,
  search: Search,
  blocks: Blocks,
  "graduation-cap": GraduationCap,
  trophy: Trophy,
  target: Target,
  crosshair: Crosshair,
  medal: Medal,
};

export function achievementIcon(name: string): LucideIcon {
  return ACHIEVEMENT_ICON_COMPONENTS[name as AchievementIconName] ?? Trophy;
}

/** Renders an achievement's icon by name, falling back to a trophy for unknown names. */
export function AchievementIcon({ name, ...props }: LucideProps & { name: string }) {
  return createElement(achievementIcon(name), props);
}
