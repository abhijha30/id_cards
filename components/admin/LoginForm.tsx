"use client";

import { useActionState } from "react";
import { signIn } from "@/app/admin/actions";
import { FormMessage } from "@/components/admin/FormMessage";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { IDLE } from "@/lib/validation/common";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState(signIn, IDLE);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const echoedEmail = state.status === "error" ? (state.values?.email ?? "") : "";

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="email" className="field-label">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue={echoedEmail}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "email-error" : undefined}
          className="input"
        />
        {errors.email && (
          <p id="email-error" className="field-error">
            {errors.email}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="password" className="field-label">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? "password-error" : undefined}
          className="input"
        />
        {errors.password && (
          <p id="password-error" className="field-error">
            {errors.password}
          </p>
        )}
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Signing in..." className="btn btn-primary w-full">
        Sign in
      </SubmitButton>
    </form>
  );
}
