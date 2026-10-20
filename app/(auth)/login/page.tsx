import { Link } from "@cesuain/ui";
import type { Metadata } from "next";
import NextLink from "next/link";
import AuthForm from "@/components/auth/AuthForm";
import ConfigNotice from "@/components/auth/ConfigNotice";
import { safeNextPath } from "@/lib/auth";
import { signInAction } from "../actions";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  return (
    <>
      <ConfigNotice />
      <AuthForm
        title="Welcome back"
        description="Sign in to continue your quizzes, XP and achievements."
        submitLabel="Sign in"
        pendingLabel="Signing in…"
        action={signInAction}
        hidden={{ next }}
        notice={params.error === "link" ? "That link is invalid or has expired. Sign in, or request a new link." : undefined}
        fields={[
          { name: "email", label: "Email", type: "email", autoComplete: "email", required: true },
          { name: "password", label: "Password", type: "password", autoComplete: "current-password", required: true },
        ]}
        footer={
          <>
            <Link asChild>
              <NextLink href="/forgot-password">Forgot your password?</NextLink>
            </Link>
            <span>
              New here?{" "}
              <Link asChild>
                <NextLink href="/signup">Create an account</NextLink>
              </Link>
            </span>
          </>
        }
      />
    </>
  );
}
