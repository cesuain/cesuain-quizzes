"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNextPath } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type AuthFormState =
  | { status: "error"; message: string; fieldErrors?: Record<string, string>; values?: Record<string, string> }
  | { status: "success"; message: string }
  | undefined;

const email = z.email({ error: "Enter a valid email address." }).max(254);
const password = z
  .string()
  .min(8, { error: "Use at least 8 characters." })
  .max(72, { error: "Use at most 72 characters." });

function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    result[key] ??= issue.message;
  }
  return result;
}

async function siteUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protocol = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${protocol}://${host}`;
}

// Auth errors from Supabase are mapped to messages that do not reveal whether an account exists.
function authMessage(code: string | undefined, fallback: string): string {
  switch (code) {
    case "invalid_credentials":
      return "Incorrect email or password.";
    case "email_not_confirmed":
      return "Confirm your email address first. Check your inbox for the link.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Too many attempts. Wait a minute and try again.";
    case "weak_password":
      return "Choose a stronger password.";
    case "same_password":
      return "Choose a password different from your current one.";
    default:
      return fallback;
  }
}

export async function signInAction(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = z
    .object({ email, password: z.string().min(1, { error: "Enter your password." }) })
    .safeParse({ email: formData.get("email"), password: formData.get("password") });
  const values = { email: String(formData.get("email") ?? "") };
  if (!parsed.success) {
    return { status: "error", message: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error), values };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { status: "error", message: authMessage(error.code, "Could not sign you in. Try again."), values };

  redirect(safeNextPath(formData.get("next")));
}

export async function signUpAction(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = z
    .object({
      displayName: z.string().trim().max(80, { error: "Use at most 80 characters." }),
      email,
      password,
    })
    .safeParse({
      displayName: formData.get("displayName") ?? "",
      email: formData.get("email"),
      password: formData.get("password"),
    });
  const values = { email: String(formData.get("email") ?? ""), displayName: String(formData.get("displayName") ?? "") };
  if (!parsed.success) {
    return { status: "error", message: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error), values };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${await siteUrl()}/auth/confirm?next=/dashboard`,
      data: parsed.data.displayName ? { display_name: parsed.data.displayName } : undefined,
    },
  });
  if (error) return { status: "error", message: authMessage(error.code, "Could not create the account. Try again."), values };

  // With email confirmations disabled Supabase signs the user in right away.
  if (data.session) redirect("/dashboard");
  return {
    status: "success",
    message: `Check ${parsed.data.email} for a confirmation link to finish creating your account.`,
  };
}

export async function requestPasswordResetAction(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = z.object({ email }).safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: fieldErrors(parsed.error),
      values: { email: String(formData.get("email") ?? "") },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await siteUrl()}/auth/confirm?next=/reset-password`,
  });
  if (error?.code === "over_email_send_rate_limit" || error?.code === "over_request_rate_limit") {
    return { status: "error", message: authMessage(error.code, "") };
  }
  // Same answer whether or not the account exists.
  return {
    status: "success",
    message: `If an account exists for ${parsed.data.email}, a link to reset the password is on its way.`,
  };
}

export async function updatePasswordAction(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = z
    .object({ password, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { path: ["confirm"], error: "The passwords do not match." })
    .safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) {
    return { status: "error", message: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) {
    return { status: "error", message: "This reset link has expired. Request a new one." };
  }
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { status: "error", message: authMessage(error.code, "Could not update the password. Try again.") };

  redirect("/dashboard");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
