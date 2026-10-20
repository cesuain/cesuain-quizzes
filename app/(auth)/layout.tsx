import { BookOpenCheck } from "lucide-react";
import NextLink from "next/link";
import SiteFooter from "@/components/shell/SiteFooter";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
        <NextLink href="/" className="flex items-center gap-2 rounded-control focus-ring">
          <BookOpenCheck aria-hidden className="size-7 text-brand" />
          <span className="font-display text-display-md leading-none">Interview Quizzes</span>
        </NextLink>
        <div className="w-full max-w-md">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
