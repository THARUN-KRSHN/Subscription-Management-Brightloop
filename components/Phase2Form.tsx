"use client";
import { useActionState, useState } from "react";
import type { Field } from "@/lib/catalogue";
import type { FormAction } from "@/lib/action-state";
import type { LookupKind } from "@/app/admin/lookups";
import { LookupSelect } from "@/components/LookupSelect";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/SubmitButton";
export function Phase2Form({
  action,
  fields,
  initial = {},
  hidden = {},
  lookups = {},
  labels = {},
  submitLabel = "Save changes",
  productScopeOnly = false,
}: {
  action: FormAction;
  fields: Field[];
  initial?: Record<string, string | boolean>;
  hidden?: Record<string, string>;
  lookups?: Record<string, LookupKind>;
  labels?: Record<string, string>;
  submitLabel?: string;
  productScopeOnly?: boolean;
}) {
  const [state, formAction] = useActionState(action, {});
  const [values, setValues] = useState(initial);
  const [chosenLabels, setLabels] = useState(labels);
  function change(name: string, value: string | boolean, label = "") {
    setValues((previous) => ({
      ...previous,
      [name]: value,
      ...(name === "product_id" ? { variant_id: "" } : {}),
    }));
    if (label) setLabels((previous) => ({ ...previous, [name]: label }));
  }
  return (
    <form action={formAction} className="grid gap-5">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <div className="grid gap-5 sm:grid-cols-2">
        {fields.map((field) => {
          if (
            productScopeOnly &&
            field.name === "product_id" &&
            values.scope !== "product"
          )
            return (
              <input
                key={field.name}
                type="hidden"
                name="product_id"
                value=""
              />
            );
          const id = `${hidden.id ?? hidden.subscription_id ?? hidden.template_id ?? "new"}-${field.name}`;
          const value = String(values[field.name] ?? "");
          const error = state.fieldErrors?.[field.name];
          return (
            <div
              key={field.name}
              className={field.type === "checkbox" ? "sm:col-span-2" : ""}
            >
              {lookups[field.name] ? (
                <LookupSelect
                  key={
                    field.name === "variant_id"
                      ? String(values.product_id)
                      : field.name
                  }
                  kind={lookups[field.name]}
                  label={field.label}
                  name={field.name}
                  value={value}
                  selectedLabel={chosenLabels[field.name]}
                  onChange={(value, label) => change(field.name, value, label)}
                  parentId={
                    field.name === "variant_id" && values.product_id
                      ? Number(values.product_id)
                      : null
                  }
                  required={field.required}
                />
              ) : field.type === "checkbox" ? (
                <label
                  className="flex min-h-10 items-center gap-3 text-sm"
                  htmlFor={id}
                >
                  <input
                    id={id}
                    name={field.name}
                    type="checkbox"
                    checked={values[field.name] === true}
                    onChange={(event) =>
                      change(field.name, event.target.checked)
                    }
                    className="size-4"
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
                      onChange={(event) =>
                        change(field.name, event.target.value)
                      }
                    >
                      {field.options?.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id={id}
                      name={field.name}
                      type={field.type ?? "text"}
                      value={value}
                      onChange={(event) =>
                        change(field.name, event.target.value)
                      }
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      required={field.required}
                      maxLength={
                        !field.type || field.type === "text" ? 200 : undefined
                      }
                      aria-invalid={!!error}
                    />
                  )}
                </label>
              )}
              {field.help && (
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {field.help}
                </p>
              )}
              {error && (
                <p className="mt-1 text-sm text-destructive">{error}</p>
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
      <div className="sticky bottom-0 -mx-4 -mb-4 mt-2 border-t bg-card/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-card/75 rounded-b-[14px]">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
