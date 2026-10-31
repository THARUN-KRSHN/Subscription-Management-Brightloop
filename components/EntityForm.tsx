"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/SubmitButton";
import { buttonVariants } from "@/components/ui/button";
import type { Field } from "@/lib/catalogue";
import type { FormAction } from "@/lib/action-state";

export function EntityForm({
  action,
  fields,
  initial = {},
  hidden = {},
  cancelHref,
  submitLabel,
}: {
  action: FormAction;
  fields: Field[];
  initial?: Record<string, string | boolean>;
  hidden?: Record<string, string>;
  cancelHref?: string;
  submitLabel?: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const [values, setValues] = useState(initial);
  return (
    <form action={formAction} className="grid gap-5">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <div className="grid gap-5 sm:grid-cols-2">
        {fields.map((field) => {
          const id = `${hidden.id ?? hidden.product_id ?? "new"}-${field.name}`;
          const error = state.fieldErrors?.[field.name];
          const helpId = `${id}-help`;
          const errorId = `${id}-error`;
          const value = String(values[field.name] ?? "");
          const change = (value: string | boolean) =>
            setValues((previous) => ({ ...previous, [field.name]: value }));
          return (
            <div
              key={field.name}
              className={
                field.type === "textarea" || field.type === "checkbox"
                  ? "sm:col-span-2"
                  : ""
              }
            >
              {field.type === "checkbox" ? (
                <label
                  htmlFor={id}
                  className="flex min-h-10 items-center gap-3 text-sm"
                >
                  <input
                    className="size-4"
                    type="checkbox"
                    id={id}
                    name={field.name}
                    checked={values[field.name] === true}
                    onChange={(event) => change(event.target.checked)}
                  />
                  {field.label}
                </label>
              ) : (
                <label className="field" htmlFor={id}>
                  {field.label}
                  {field.type === "select" ? (
                    <select
                      id={id}
                      name={field.name}
                      value={value}
                      onChange={(event) => change(event.target.value)}
                      required={field.required}
                      aria-invalid={!!error}
                      aria-describedby={
                        error ? errorId : field.help ? helpId : undefined
                      }
                    >
                      {field.options?.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : field.type === "textarea" ? (
                    <textarea
                      id={id}
                      name={field.name}
                      value={value}
                      onChange={(event) => change(event.target.value)}
                      maxLength={2000}
                      aria-invalid={!!error}
                      aria-describedby={error ? errorId : undefined}
                    />
                  ) : (
                    <Input
                      id={id}
                      name={field.name}
                      type={field.type ?? "text"}
                      value={value}
                      onChange={(event) => change(event.target.value)}
                      required={field.required}
                      step={field.step}
                      min={field.min}
                      max={field.max}
                      maxLength={
                        field.type === "text" || !field.type ? 200 : undefined
                      }
                      aria-invalid={!!error}
                      aria-describedby={
                        error ? errorId : field.help ? helpId : undefined
                      }
                    />
                  )}
                </label>
              )}
              {field.help && (
                <p
                  id={helpId}
                  className="mt-1.5 text-xs leading-5 text-muted-foreground"
                >
                  {field.help}
                </p>
              )}
              {error && (
                <p id={errorId} className="mt-1 text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>
          );
        })}
      </div>
      {state.error && (
        <p
          role="alert"
          className="rounded-md bg-red-50 p-3 text-sm text-red-800"
        >
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="text-sm text-primary">
          {state.message}
        </p>
      )}
      <div className="flex flex-wrap gap-3 border-t pt-5">
        <SubmitButton>{submitLabel ?? "Save changes"}</SubmitButton>
        {cancelHref && (
          <Link
            className={buttonVariants({ variant: "outline" })}
            href={cancelHref}
          >
            Cancel
          </Link>
        )}
      </div>
    </form>
  );
}
