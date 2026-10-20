"use client";

import { cn } from "@cesuain/ui";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { usePractice } from "./PracticeProvider";

const STEPS = [
  { href: "/practice/create", label: "1. Describe & generate prompt" },
  { href: "/practice/import", label: "2. Import quiz JSON" },
  { href: "/practice/play", label: "3. Practice" },
] as const;

export default function PracticeSteps() {
  const pathname = usePathname();
  const { session } = usePractice();
  return (
    <nav aria-label="Custom Quiz Generator steps">
      <ol className="flex flex-wrap gap-2">
        {STEPS.map((step) => {
          const active = pathname === step.href;
          const disabled = step.href === "/practice/play" && !session && !active;
          return (
            <li key={step.href}>
              {disabled ? (
                <span className="inline-flex h-9 items-center rounded-full border border-border px-4 text-label-sm text-muted-foreground opacity-60">
                  {step.label}
                </span>
              ) : (
                <NextLink
                  href={step.href}
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "inline-flex h-9 items-center rounded-full border px-4 text-label-sm focus-ring",
                    active ? "border-brand bg-brand/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {step.label}
                </NextLink>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
