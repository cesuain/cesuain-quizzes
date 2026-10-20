"use client";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  ThemeToggle,
  cn,
} from "@cesuain/ui";
import { BookOpenCheck, LogOut, Menu, Sparkles } from "lucide-react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOutAction } from "@/app/(auth)/actions";
import { THEME_STORAGE_KEY } from "@/lib/theme";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/quizzes", label: "Quizzes" },
  { href: "/practice/create", label: "Custom Quiz Generator", match: "/practice" },
  { href: "/history", label: "History" },
  { href: "/progress", label: "Progress" },
  { href: "/achievements", label: "Achievements" },
] as const;

function isActive(pathname: string, item: (typeof NAV_ITEMS)[number]) {
  const base = "match" in item ? item.match : item.href;
  return pathname === base || pathname.startsWith(`${base}/`) || (base === "/history" && pathname.startsWith("/results"));
}

interface Props {
  email: string | null;
  displayName: string | null;
}

export default function AppHeader({ email, displayName }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = (onNavigate?: () => void) =>
    NAV_ITEMS.map((item) => {
      const active = isActive(pathname, item);
      return (
        <Button
          key={item.href}
          asChild
          variant="ghost"
          size="sm"
          className={cn("justify-start", active && "bg-accent text-accent-foreground")}
        >
          <NextLink href={item.href} aria-current={active ? "page" : undefined} onClick={onNavigate}>
            {item.href === "/practice/create" && <Sparkles aria-hidden className="size-4" />}
            {item.label}
          </NextLink>
        </Button>
      );
    });

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-page-xl items-center gap-3 px-4 sm:px-6">
        <NextLink href="/dashboard" className="flex items-center gap-2 rounded-control focus-ring">
          <BookOpenCheck aria-hidden className="size-6 text-brand" />
          <span className="font-display text-display-sm leading-none">Interview Quizzes</span>
        </NextLink>

        <nav aria-label="Main" className="ml-4 hidden flex-1 items-center gap-1 lg:flex">
          {links()}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle storageKey={THEME_STORAGE_KEY} size="sm" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="max-w-48">
                <span className="truncate">{displayName || email || "Account"}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="text-body-xs text-muted-foreground">{email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <form action={signOutAction}>
                <DropdownMenuItem asChild>
                  <button type="submit" className="w-full">
                    <LogOut aria-hidden className="size-4" />
                    Sign out
                  </button>
                </DropdownMenuItem>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <IconButton label="Open navigation" icon={<Menu />} variant="ghost" size="sm" className="lg:hidden" />
            </SheetTrigger>
            <SheetContent side="right" closeLabel="Close navigation">
              <SheetHeader>
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              <nav aria-label="Main" className="flex flex-col gap-1 px-4">
                {links(() => setOpen(false))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
