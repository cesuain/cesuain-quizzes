import { Badge } from "@cesuain/ui";
import { levelLabels } from "@/lib/i18n";
import type { Language, Level } from "@/lib/types";

const VARIANT: Record<Level, "success" | "warning" | "destructive"> = {
  basic: "success",
  intermediate: "warning",
  advanced: "destructive",
};

export default function LevelBadge({ level, language = "en" }: { level: Level; language?: Language }) {
  return (
    <Badge variant={VARIANT[level]} size="sm">
      {levelLabels[language][level]}
    </Badge>
  );
}
