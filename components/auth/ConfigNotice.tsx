import { Alert, AlertDescription, AlertTitle } from "@cesuain/ui";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/** Explains a missing Supabase setup instead of failing on submit. */
export default function ConfigNotice() {
  if (isSupabaseConfigured()) return null;
  return (
    <Alert variant="warning" className="mb-4">
      <AlertTitle>Supabase is not configured</AlertTitle>
      <AlertDescription>
        Copy <code>.env.example</code> to <code>.env.local</code> and set the Supabase URL and publishable key. See the README.
      </AlertDescription>
    </Alert>
  );
}
