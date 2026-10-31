"use client";
import { useActionState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import type { FormAction } from "@/lib/action-state";
export function RecordAction({
  action,
  hidden,
  label,
  confirm = false,
}: {
  action: FormAction;
  hidden: Record<string, string>;
  label: string;
  confirm?: boolean;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (confirm && !window.confirm(`${label}? This cannot be undone.`))
          event.preventDefault();
      }}
      className="grid gap-2"
    >
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <SubmitButton variant={confirm ? "destructive" : "outline"}>
        {label}
      </SubmitButton>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="text-sm text-primary">
          {state.message}
        </p>
      )}
    </form>
  );
}
