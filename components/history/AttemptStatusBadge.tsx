import { Badge } from "@cesuain/ui";
import type { AttemptStatus } from "@/lib/data/types";

const LABEL: Record<AttemptStatus, string> = { completed: "Completed", in_progress: "In progress", abandoned: "Abandoned" };
const VARIANT = { completed: "success", in_progress: "warning", abandoned: "outline" } as const;

export default function AttemptStatusBadge({ status }: { status: AttemptStatus }) {
  return (
    <Badge variant={VARIANT[status]} size="sm">
      {LABEL[status]}
    </Badge>
  );
}
