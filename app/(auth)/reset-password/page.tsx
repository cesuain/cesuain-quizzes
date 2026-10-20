import type { Metadata } from "next";
import AuthForm from "@/components/auth/AuthForm";
import { requireUser } from "@/lib/auth";
import { updatePasswordAction } from "../actions";

export const metadata: Metadata = { title: "Choose a new password" };

// Reached from the recovery email: /auth/confirm signs the user in, then redirects here.
export default async function ResetPasswordPage() {
  await requireUser("/reset-password");
  return (
    <AuthForm
      title="Choose a new password"
      description="Enter a new password for your account."
      submitLabel="Update password"
      pendingLabel="Updating…"
      action={updatePasswordAction}
      fields={[
        {
          name: "password",
          label: "New password",
          type: "password",
          autoComplete: "new-password",
          required: true,
          description: "At least 8 characters.",
        },
        { name: "confirm", label: "Confirm new password", type: "password", autoComplete: "new-password", required: true },
      ]}
    />
  );
}
