"use client";

import { cn } from "@cesuain/ui";
import { useState } from "react";
import { formatNumber } from "@/lib/format";

export interface DayXp {
  /** YYYY-MM-DD */
  date: string;
  xp: number;
}

const dayLabel = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });
const label = (date: string) => dayLabel.format(new Date(`${date}T00:00:00Z`));

/** One series: XP earned per day. Hover or focus a bar for its value; a table view follows. */
export default function XpByDayChart({ days }: { days: DayXp[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...days.map((d) => d.xp), 1);
  const total = days.reduce((sum, d) => sum + d.xp, 0);
  const shown = active === null ? null : days[active];

  return (
    <figure className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3 text-body-sm">
        <figcaption className="text-muted-foreground">XP per day, last {days.length} days</figcaption>
        <span className="tabular-nums text-foreground" aria-live="polite">
          {shown ? `${label(shown.date)}: ${formatNumber(shown.xp)} XP` : `${formatNumber(total)} XP in total`}
        </span>
      </div>
      <div
        className="relative flex h-40 items-end gap-0.5 border-b border-border"
        role="list"
        aria-label="XP earned per day"
        onMouseLeave={() => setActive(null)}
      >
        {days.map((day, i) => (
          <button
            key={day.date}
            type="button"
            role="listitem"
            aria-label={`${label(day.date)}: ${day.xp} XP`}
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            className="flex h-full flex-1 items-end focus-ring rounded-xs"
          >
            <span
              aria-hidden
              className={cn(
                "block w-full rounded-t-[4px] bg-(--chart-1) transition-opacity",
                active !== null && active !== i && "opacity-50",
              )}
              style={{ height: day.xp > 0 ? `max(2px, ${(day.xp / max) * 100}%)` : 0 }}
            />
          </button>
        ))}
      </div>
      <div className="flex justify-between text-body-xs text-muted-foreground" aria-hidden>
        <span>{days[0] && label(days[0].date)}</span>
        <span>{days.at(-1) && label(days.at(-1)!.date)}</span>
      </div>
      <details className="text-body-sm">
        <summary className="cursor-pointer text-muted-foreground focus-ring rounded-xs w-fit">Show as table</summary>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr className="text-muted-foreground">
              <th className="py-1 font-normal">Day</th>
              <th className="py-1 text-right font-normal">XP</th>
            </tr>
          </thead>
          <tbody>
            {days
              .filter((d) => d.xp > 0)
              .map((d) => (
                <tr key={d.date} className="border-t border-border">
                  <td className="py-1">{label(d.date)}</td>
                  <td className="py-1 text-right tabular-nums">{formatNumber(d.xp)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
