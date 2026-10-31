"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { Check, Circle } from "lucide-react";
import {
  login,
  signup,
  forgotPassword,
  resetPassword,
  type AuthState,
} from "@/app/(auth)/actions";
import { validatePassword } from "@/lib/validation";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/SubmitButton";

const actions = {
  login,
  signup,
  "forgot-password": forgotPassword,
  "reset-password": resetPassword,
};
export function AuthForm({ mode }: { mode: keyof typeof actions }) {
  const [state, action] = useActionState<AuthState, FormData>(
    actions[mode],
    {},
  );
  const [password, setPassword] = useState("");
  const passwordRules = mode === "signup" || mode === "reset-password";
  const labels = {
    login: "Log in",
    signup: "Create account",
    "forgot-password": "Send reset link",
    "reset-password": "Set new password",
  };
  const rules = validatePassword(password).rules;
  return (
    <form action={action} className="grid gap-5">
      {mode === "signup" && (
        <label className="field" htmlFor="full_name">
          Full name
          <Input
            id="full_name"
            name="full_name"
            autoComplete="name"
            required
            maxLength={200}
          />
        </label>
      )}
      {mode !== "reset-password" && (
        <label className="field" htmlFor="email">
          Email address
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@company.com"
          />
        </label>
      )}
      {mode !== "forgot-password" && (
        <div>
          <label className="field" htmlFor="password">
            {mode === "reset-password" ? "New password" : "Password"}
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={passwordRules ? 9 : undefined}
              aria-describedby={passwordRules ? "password-rules" : undefined}
            />
          </label>
          {passwordRules && (
            <ul
              id="password-rules"
              className="mt-3 grid gap-2 text-xs"
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
                <li
                  key={key}
                  className={`flex items-center gap-2 ${rules[key] ? "text-primary" : "text-muted-foreground"}`}
                >
                  {rules[key] ? (
                    <Check size={14} aria-hidden="true" />
                  ) : (
                    <Circle size={14} aria-hidden="true" />
                  )}
                  <span className="sr-only">
                    {rules[key] ? "Met: " : "Not met: "}
                  </span>
                  {label}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {state.error && (
        <p
          role="alert"
          className="rounded-md bg-red-50 p-3 text-sm text-red-800"
        >
          {state.error}
        </p>
      )}
      {state.message && (
        <p
          role="status"
          className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900"
        >
          {state.message}
        </p>
      )}
      <SubmitButton>{labels[mode]}</SubmitButton>
      {mode === "login" && (
        <div className="flex flex-wrap justify-between gap-3 text-sm">
          <Link href="/forgot-password" className="text-primary underline">
            Forgot password?
          </Link>
          <Link href="/signup" className="text-primary underline">
            Create an account
          </Link>
        </div>
      )}
      {mode !== "login" && (
        <Link
          href="/login"
          className="text-center text-sm text-primary underline"
        >
          Back to log in
        </Link>
      )}
    </form>
  );
}
