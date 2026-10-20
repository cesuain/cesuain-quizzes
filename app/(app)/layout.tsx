import AppHeader from "@/components/shell/AppHeader";
import SiteFooter from "@/components/shell/SiteFooter";
import { requireUser } from "@/lib/auth";

// Every page in this group belongs to the signed-in user.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <AppHeader email={user.email} displayName={user.displayName} />
      <main id="main" className="mx-auto w-full max-w-page-xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
