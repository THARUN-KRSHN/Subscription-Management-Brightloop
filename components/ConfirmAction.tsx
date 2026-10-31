"use client";
import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import type { FormAction } from "@/lib/action-state";

export function ConfirmAction({
  action,
  hidden,
  label,
  message,
  destructive = false,
}: {
  action: FormAction;
  hidden: Record<string, string>;
  label: string;
  message: string;
  destructive?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(action, {});
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-medium ${destructive ? "bg-destructive text-white" : "border"}`}
      >
        {label}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <form
            action={async (fd) => {
              await formAction(fd);
              setOpen(false);
            }}
            className="w-full max-w-sm rounded-md bg-white p-4 shadow"
          >
            <p className="mb-4 text-sm">{message}</p>
            {Object.entries(hidden).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border px-3 py-1.5 text-sm"
              >
                Cancel
              </button>
              <SubmitButton variant={destructive ? "destructive" : "default"}>
                Confirm
              </SubmitButton>
            </div>
            {state.error && (
              <p role="alert" className="mt-2 text-sm text-destructive">
                {state.error}
              </p>
            )}
            {state.message && (
              <p role="status" className="mt-2 text-sm text-primary">
                {state.message}
              </p>
            )}
          </form>
        </div>
      )}
    </>
  );
}
