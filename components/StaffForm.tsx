"use client";
import { useActionState, useState } from "react";
import { createStaff } from "@/app/admin/actions";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/SubmitButton";
import { validatePassword } from "@/lib/validation";
export function StaffForm() {
  const [state, action] = useActionState(createStaff, {});
  const [password, setPassword] = useState("");
  const rules = validatePassword(password).rules;
  return (
    <form action={action} className="grid max-w-xl gap-5">
      <label className="field" htmlFor="full_name">
        Full name
        <Input
          id="full_name"
          name="full_name"
          autoComplete="name"
          required
          maxLength={200}
        />
        {state.fieldErrors?.full_name && (
          <span className="text-destructive">
            {state.fieldErrors.full_name}
          </span>
        )}
      </label>
      <label className="field" htmlFor="email">
        Email
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
        {state.fieldErrors?.email && (
          <span className="text-destructive">{state.fieldErrors.email}</span>
        )}
      </label>
      <label className="field" htmlFor="password">
        Temporary password
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={9}
          aria-describedby="staff-password-rules"
        />
      </label>
      <ul
        id="staff-password-rules"
        className="grid gap-1 text-xs text-muted-foreground"
        aria-live="polite"
      >
        {(
          [
            ["length", "At least 9 characters"],
            ["uppercase", "One uppercase letter"],
            ["lowercase", "One lowercase letter"],
            ["special", "One special character"],
          ] as const
        ).map(([key, label]) => (
          <li key={key} className={rules[key] ? "text-primary" : ""}>
            {label}: {rules[key] ? "met" : "not met"}
          </li>
        ))}
      </ul>
      {state.fieldErrors?.password && (
        <p className="text-sm text-destructive">{state.fieldErrors.password}</p>
      )}
      <p className="text-sm text-muted-foreground">
        Share this temporary password securely. The staff member can change it
        using the password reset flow.
      </p>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <div>
        <SubmitButton>Create staff account</SubmitButton>
      </div>
    </form>
  );
}
