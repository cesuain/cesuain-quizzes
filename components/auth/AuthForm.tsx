"use client";

import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
} from "@cesuain/ui";
import { useActionState, useId } from "react";
import type { AuthFormState } from "@/app/(auth)/actions";

export interface AuthField {
  name: string;
  label: string;
  type: "email" | "password" | "text";
  autoComplete: string;
  required?: boolean;
  description?: string;
}

interface Props {
  title: string;
  description: string;
  submitLabel: string;
  pendingLabel: string;
  fields: AuthField[];
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  hidden?: Record<string, string>;
  /** Shown above the form, e.g. after an expired email link. */
  notice?: string;
  footer?: React.ReactNode;
}

export default function AuthForm({ title, description, submitLabel, pendingLabel, fields, action, hidden, notice, footer }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const id = useId();
  const values = state?.status === "error" ? state.values : undefined;
  const errors = state?.status === "error" ? state.fieldErrors : undefined;

  return (
    <Card>
      <CardHeader>
        <h1 className="text-heading-md text-foreground">{title}</h1>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {notice && !state && (
          <Alert variant="warning">
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        )}
        {state && (
          <Alert variant={state.status === "success" ? "success" : "destructive"}>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        )}
        {state?.status !== "success" && (
          <form action={formAction} noValidate aria-busy={pending}>
            {hidden && Object.entries(hidden).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
            <FieldGroup>
              {fields.map((field) => {
                const error = errors?.[field.name];
                const inputId = `${id}-${field.name}`;
                return (
                  <Field key={field.name} invalid={!!error}>
                    <FieldLabel htmlFor={inputId} required={field.required}>
                      {field.label}
                    </FieldLabel>
                    <Input
                      id={inputId}
                      name={field.name}
                      type={field.type}
                      autoComplete={field.autoComplete}
                      required={field.required}
                      defaultValue={field.type === "password" ? undefined : values?.[field.name]}
                      aria-invalid={!!error || undefined}
                      aria-describedby={
                        [error && `${inputId}-error`, field.description && `${inputId}-hint`].filter(Boolean).join(" ") ||
                        undefined
                      }
                    />
                    {field.description && <FieldDescription id={`${inputId}-hint`}>{field.description}</FieldDescription>}
                    {error && <FieldError id={`${inputId}-error`}>{error}</FieldError>}
                  </Field>
                );
              })}
              <Button type="submit" variant="gradient" size="lg" loading={pending} className="w-full">
                {pending ? pendingLabel : submitLabel}
              </Button>
            </FieldGroup>
          </form>
        )}
      </CardContent>
      {footer && <CardFooter className="flex flex-col items-start gap-2 text-body-sm text-muted-foreground">{footer}</CardFooter>}
    </Card>
  );
}
