import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function Home() {
  // Decide per request, never at build time.
  await connection();
  if (!isSupabaseConfigured()) redirect("/login");
  redirect((await getCurrentUser()) ? "/dashboard" : "/login");
}
