import { Link } from "@cesuain/ui";
import type { Metadata } from "next";
import NextLink from "next/link";
import AuthForm from "@/components/auth/AuthForm";
import { requestPasswordResetAction } from "../actions";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <AuthForm
      title="Reset your password"
      description="Enter your email and we will send you a link to choose a new password."
      submitLabel="Send reset link"
      pendingLabel="Sending…"
      action={requestPasswordResetAction}
      fields={[{ name: "email", label: "Email", type: "email", autoComplete: "email", required: true }]}
      footer={
        <Link asChild>
          <NextLink href="/login">Back to sign in</NextLink>
        </Link>
      }
    />
  );
}
