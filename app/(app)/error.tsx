"use client";

import { Alert, AlertDescription, AlertTitle, Button } from "@cesuain/ui";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const configMissing = error.message.includes("Supabase is not configured");
  return (
    <Alert variant="destructive">
      <AlertTitle>{configMissing ? "Supabase is not configured" : "Something went wrong"}</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-3">
        <p>
          {configMissing
            ? "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (see .env.example)."
            : "We could not load this page. Your official progress is saved; try again."}
        </p>
        <Button size="sm" variant="outline" onClick={reset}>
          Try again
        </Button>
      </AlertDescription>
    </Alert>
  );
}
