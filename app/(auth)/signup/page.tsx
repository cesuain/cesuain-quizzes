import { Link } from "@cesuain/ui";
import type { Metadata } from "next";
import NextLink from "next/link";
import AuthForm from "@/components/auth/AuthForm";
import ConfigNotice from "@/components/auth/ConfigNotice";
import { signUpAction } from "../actions";

export const metadata: Metadata = { title: "Create an account" };

export default function SignupPage() {
  return (
    <>
      <ConfigNotice />
      <AuthForm
        title="Create your account"
        description="Track official quiz results, earn XP and unlock achievements."
        submitLabel="Create account"
        pendingLabel="Creating account…"
        action={signUpAction}
        fields={[
          { name: "displayName", label: "Display name", type: "text", autoComplete: "nickname", description: "Optional." },
          { name: "email", label: "Email", type: "email", autoComplete: "email", required: true },
          {
            name: "password",
            label: "Password",
            type: "password",
            autoComplete: "new-password",
            required: true,
            description: "At least 8 characters.",
          },
        ]}
        footer={
          <span>
            Already have an account?{" "}
            <Link asChild>
              <NextLink href="/login">Sign in</NextLink>
            </Link>
          </span>
        }
      />
    </>
  );
}
