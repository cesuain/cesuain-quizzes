import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "./supabase/server";

export interface SessionUser {
  id: string;
  email: string | null;
  displayName: string | null;
}

/**
 * Verifies the session on the server. `getClaims()` validates the JWT signature (against the
 * project's JWKS for asymmetric keys, or with the Auth server otherwise), so a forged or
 * expired cookie is rejected.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const claims = data.claims;
  const metadata = (claims.user_metadata ?? {}) as Record<string, unknown>;
  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    displayName: typeof metadata.display_name === "string" ? metadata.display_name : null,
  };
});

/** For pages and actions that need a signed-in user. Redirects to /login otherwise. */
export async function requireUser(next?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  return user;
}

/** Only allow same-site relative redirects after sign-in. */
export function safeNextPath(value: unknown, fallback = "/dashboard"): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  return value;
}
