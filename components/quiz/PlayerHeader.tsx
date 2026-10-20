import { Badge, Progress } from "@cesuain/ui";

interface Props {
  title: string;
  mode: "official" | "custom_practice";
  resolved: number;
  total: number;
  stats: React.ReactNode;
  actions?: React.ReactNode;
}

export default function PlayerHeader({ title, mode, resolved, total, stats, actions }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          {mode === "official" ? (
            <Badge variant="brand" size="sm" className="w-fit">
              Official quiz · XP enabled
            </Badge>
          ) : (
            <Badge variant="outline" size="sm" className="w-fit">
              Practice · not saved · no XP
            </Badge>
          )}
          <h1 className="text-heading-lg text-foreground">{title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-body-sm">
          {stats}
          {actions}
        </div>
      </div>
      <Progress
        value={total ? (resolved / total) * 100 : 0}
        size="sm"
        tone="brand"
        aria-label={`${resolved} of ${total} questions answered`}
      />
    </div>
  );
}
