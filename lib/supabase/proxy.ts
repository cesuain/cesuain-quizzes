import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";
import { isSupabaseConfigured, supabaseEnv } from "./env";

/** Routes that need a session. Pages also verify the session themselves (lib/auth.ts). */
export const PROTECTED_PREFIXES = [
  "/dashboard",
  "/quizzes",
  "/results",
  "/history",
  "/progress",
  "/achievements",
  "/practice",
  "/account",
];

const AUTH_PAGES = ["/login", "/signup", "/forgot-password"];

function matches(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Refreshes the Supabase session cookie on every request and redirects optimistically.
 * This is not the security boundary: pages call requireUser() and the database enforces RLS.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!isSupabaseConfigured()) return response;

  const { url, publishableKey } = supabaseEnv();
  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // Do not run code between createServerClient and getClaims(): it refreshes the session.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;

  const redirectTo = (path: string, next?: string) => {
    const target = request.nextUrl.clone();
    target.pathname = path;
    target.search = next ? `?next=${encodeURIComponent(next)}` : "";
    const redirect = NextResponse.redirect(target);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  };

  if (!signedIn && matches(pathname, PROTECTED_PREFIXES)) return redirectTo("/login", pathname + search);
  if (signedIn && matches(pathname, AUTH_PAGES)) return redirectTo("/dashboard");

  return response;
}
