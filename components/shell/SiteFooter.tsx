import { Link } from "@cesuain/ui";

export const PORTFOLIO_URL = "https://cesarfonseca.dev/";
export const STORYBOOK_URL = "https://storybook.cesarfonseca.dev/";

export default function SiteFooter() {
  return (
    <footer className="border-t border-border py-6 text-center text-body-xs text-muted-foreground">
      Built by{" "}
      <Link href={PORTFOLIO_URL} variant="subtle" external>
        Cesar Fonseca
      </Link>{" "}
      ·{" "}
      <Link href={STORYBOOK_URL} variant="subtle" external>
        Design System
      </Link>
    </footer>
  );
}
