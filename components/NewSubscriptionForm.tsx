"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  createSubscription,
  templatePreview,
} from "@/app/admin/subscriptions/actions";
import { LookupSelect } from "@/components/LookupSelect";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { today, oneYearAfter } from "@/lib/dates";
import { formatMoney, fromCents, toCents } from "@/lib/money";
import { lineAmount } from "@/lib/subscriptions/calculations";
type Preview = Awaited<ReturnType<typeof templatePreview>>;
export function NewSubscriptionForm({
  initialTemplate = "",
  initialPreview,
}: {
  initialTemplate?: string;
  initialPreview?: Preview;
}) {
  const [state, action, pending] = useActionState(createSubscription, {});
  const [customer, setCustomer] = useState("");
  const [template, setTemplate] = useState(initialTemplate);
  const [plan, setPlan] = useState(
    initialPreview?.plan ? String(initialPreview.plan.id) : "",
  );
  const [terms, setTerms] = useState("");
  const [start, setStart] = useState(today());
  const [expiry, setExpiry] = useState(oneYearAfter(today()));
  const [preview, setPreview] = useState<Preview | undefined>(initialPreview);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewedTemplate = useRef(
    initialPreview?.template ? String(initialPreview.template.id) : "",
  );
  useEffect(() => {
    let cancelled = false;
    if (!template) {
      previewedTemplate.current = "";
      setPreview(undefined);
      setPreviewLoading(false);
      return;
    }
    if (previewedTemplate.current === template && preview?.plan) {
      setPlan(String(preview.plan.id));
      setPreviewLoading(false);
      return;
    }
    setPreviewLoading(true);
    templatePreview(Number(template))
      .then((result) => {
        if (!cancelled) {
          if (result.template) previewedTemplate.current = template;
          setPreview(result);
          setPlan(result.plan ? String(result.plan.id) : "");
          setPreviewLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreview({
            error: "Could not load this template. Try selecting it again.",
          });
          setPlan("");
          setPreviewLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [template]);
  function changeStart(value: string) {
    const wasDefault = !expiry || (!!start && expiry === oneYearAfter(start));
    setStart(value);
    if (value && wasDefault) setExpiry(oneYearAfter(value));
  }
  return (
    <form action={action} className="grid gap-8">
      <div className="grid max-w-3xl gap-6 sm:grid-cols-2">
        <LookupSelect
          kind="customers"
          name="customer_id"
          label="Customer"
          value={customer}
          onChange={setCustomer}
          required
        />
        <LookupSelect
          kind="templates"
          name="template_id"
          label="Quotation template (optional)"
          value={template}
          onChange={(value) => {
            setTemplate(value);
            setPlan("");
          }}
          selectedLabel={preview?.template?.name}
        />
        <LookupSelect
          kind="plans"
          name="plan_id"
          label="Plan"
          value={plan}
          onChange={setPlan}
          selectedLabel={preview?.plan?.name}
          disabled={!!template}
          availableOnly
          required
        />
        <LookupSelect
          kind="payment_terms"
          name="payment_terms_id"
          label="Payment terms"
          value={terms}
          onChange={setTerms}
          required
        />
        <label className="field" htmlFor="start_date">
          Start date
          <Input
            id="start_date"
            name="start_date"
            type="date"
            value={start}
            onChange={(event) => changeStart(event.target.value)}
            required
          />
        </label>
        <label className="field" htmlFor="expiry_date">
          Expiry date
          <Input
            id="expiry_date"
            name="expiry_date"
            type="date"
            value={expiry}
            onChange={(event) => setExpiry(event.target.value)}
            min={start}
            required
          />
        </label>
      </div>
      {previewLoading && (
        <p role="status" className="text-sm text-muted-foreground">
          Loading template lines…
        </p>
      )}
      {preview?.error && (
        <p role="alert" className="text-sm text-destructive">
          {preview.error}
        </p>
      )}
      {preview?.template && preview.plan && (
        <section className="max-w-3xl border-t pt-6">
          <h2 className="text-lg font-semibold">Template preview</h2>
          <p className="mt-2 mb-5 text-sm text-muted-foreground">
            Quotes valid for {preview.template.validity_days} days. If sent
            today: {preview.quoteValidUntil}. The plan and product lines are
            pre-filled; you can edit product lines after creating the draft.
          </p>
          <ul className="divide-y rounded-lg border">
            {preview.template.lines.map((line) => (
              <li
                key={line.id}
                className="flex flex-wrap justify-between gap-3 p-4 text-sm"
              >
                <span>
                  {line.description} × {line.quantity}
                </span>
                <span>
                  {formatMoney(
                    fromCents(
                      lineAmount(line.quantity, toCents(line.unit_price)),
                    ),
                  )}
                </span>
              </li>
            ))}
            <li className="flex justify-between gap-3 bg-muted/50 p-4 text-sm">
              <span>Plan fee: {preview.plan.name} × 1 (locked)</span>
              <span>{formatMoney(preview.plan.price)}</span>
            </li>
          </ul>
        </section>
      )}
      {!template && (
        <p className="max-w-prose text-sm leading-6 text-muted-foreground">
          The draft starts with one locked plan-fee line. Add product lines on
          the subscription detail page before sending a quotation.
        </p>
      )}
      {state.fieldErrors && (
        <ul role="alert" className="grid gap-1 text-sm text-destructive">
          {Object.entries(state.fieldErrors).map(([field, message]) => (
            <li key={field}>
              {field.replaceAll("_", " ")}: {message}
            </li>
          ))}
        </ul>
      )}
      {state.error && (
        <p
          role="alert"
          className="max-w-3xl rounded-md bg-red-50 p-3 text-sm text-red-800"
        >
          {state.error}
        </p>
      )}
      <div className="border-t pt-6">
        <Button
          type="submit"
          disabled={pending || previewLoading || !!preview?.error}
        >
          {pending ? "Creating…" : "Create draft subscription"}
        </Button>
      </div>
    </form>
  );
}
