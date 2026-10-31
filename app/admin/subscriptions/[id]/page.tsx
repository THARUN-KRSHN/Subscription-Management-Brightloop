import Link from "next/link";
import { notFound } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { idSchema } from "@/lib/validation";
import {
  getSubscription,
  getSubscriptionLines,
  getPlan,
} from "@/lib/subscriptions/data";
import { periodTotals } from "@/lib/subscriptions/calculations";
import { formatMoney, fromCents } from "@/lib/money";
import { parsePage, pagedResult, type SearchParams } from "@/lib/pagination";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { Phase2Form } from "@/components/Phase2Form";
import { RecordAction } from "@/components/RecordAction";
import { TransitionControls } from "@/components/TransitionControls";
import { Notice } from "@/components/EntityPages";
import {
  saveSubscriptionLine,
  removeSubscriptionLine,
  saveSubscriptionDates,
} from "../actions";
export default async function SubscriptionDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  await requireRole(["admin", "staff"]);
  const id = idSchema.safeParse((await params).id);
  if (!id.success) notFound();
  const query = await searchParams;
  const pagination = parsePage(query);
  const subscription = await getSubscription(id.data);
  const plan = await getPlan(subscription.plan_id);
  const lines = await getSubscriptionLines(id.data);
  const admin = createAdminClient();
  const [customerResult, termsResult] = await Promise.all([
    admin
      .from("customers")
      .select("contact_name,company_name,email")
      .eq("id", subscription.customer_id)
      .single(),
    admin
      .from("payment_terms")
      .select("name,due_days")
      .eq("id", subscription.payment_terms_id)
      .single(),
  ]);
  if (customerResult.error || termsResult.error)
    throw new Error("Could not load subscription customer or payment terms.");
  const customer = customerResult.data;
  const terms = termsResult.data;
  const editable = ["draft", "quotation"].includes(subscription.status);
  const totals = periodTotals(lines);
  const fields = [
    { name: "product_id", label: "Product", required: true },
    { name: "variant_id", label: "Variant" },
    {
      name: "quantity",
      label: "Quantity",
      type: "number" as const,
      min: String(plan.min_quantity),
      step: "1",
      required: true,
    },
  ];
  return (
    <>
      <Link
        href="/admin/subscriptions"
        className="mb-6 inline-flex min-h-10 items-center text-sm text-primary underline"
      >
        Back to subscriptions
      </Link>
      <PageHeader
        title={subscription.number}
        description={`${customer.company_name || customer.contact_name} · ${plan.name}`}
      />
      <Notice params={query} />
      <TransitionControls
        id={id.data}
        status={subscription.status}
        allowPause={plan.allow_pause}
      />
      <dl className="mb-8 grid gap-x-8 gap-y-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["Customer", `${customer.contact_name} · ${customer.email}`],
          ["Plan", `${plan.name} (${plan.billing_period})`],
          ["Dates", `${subscription.start_date} → ${subscription.expiry_date}`],
          ["Payment terms", `${terms.name} (${terms.due_days} days)`],
          [
            "Quote valid until",
            subscription.quote_valid_until || "Set when quotation is sent",
          ],
          [
            "Next billing date",
            subscription.next_billing_date || "Set on activation",
          ],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="mt-1 font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      {subscription.closed_at && (
        <p className="mb-6 text-sm text-muted-foreground">
          Closed at {subscription.closed_at}
        </p>
      )}
      {editable && (
        <details className="mb-8 max-w-3xl rounded-lg border p-5">
          <summary className="text-sm font-medium">
            Edit dates and payment terms
          </summary>
          <div className="mt-5">
            <Phase2Form
              action={saveSubscriptionDates}
              fields={[
                {
                  name: "payment_terms_id",
                  label: "Payment terms",
                  required: true,
                },
                {
                  name: "start_date",
                  label: "Start date",
                  type: "date",
                  required: true,
                },
                {
                  name: "expiry_date",
                  label: "Expiry date",
                  type: "date",
                  required: true,
                },
              ]}
              initial={{
                payment_terms_id: String(subscription.payment_terms_id),
                start_date: subscription.start_date,
                expiry_date: subscription.expiry_date,
              }}
              labels={{ payment_terms_id: terms.name }}
              hidden={{ subscription_id: String(id.data) }}
              lookups={{ payment_terms_id: "payment_terms" }}
            />
          </div>
        </details>
      )}
      <section>
        <h2 className="mb-2 text-xl font-semibold">Subscription lines</h2>
        <p className="mb-5 text-sm text-muted-foreground">
          {editable
            ? `Product lines need at least ${plan.min_quantity} units. Adding or editing a line snapshots current catalogue pricing; other lines stay unchanged.`
            : "Confirmed subscriptions are read-only. Prices and taxes below are saved snapshots."}
        </p>
        <DataTable
          {...pagedResult(
            lines.slice(pagination.from, pagination.to + 1),
            lines.length,
            pagination.page,
            pagination.pageSize,
          )}
          pathname={`/admin/subscriptions/${id.data}`}
          params={query}
          columns={[
            {
              label: "Product / description",
              render: (line) => (
                <span className="font-medium">{line.description}</span>
              ),
            },
            {
              label: "Variant",
              render: (line) =>
                line.variant_id
                  ? line.description.match(/\(([^()]*)\)$/)?.[1] ||
                    `Variant #${line.variant_id}`
                  : "—",
            },
            { label: "Quantity", render: (line) => line.quantity },
            {
              label: "Unit price",
              render: (line) => formatMoney(line.unit_price),
            },
            { label: "Tax", render: (line) => `${line.tax_pct}%` },
            { label: "Amount", render: (line) => formatMoney(line.amount) },
            {
              label: "Actions",
              render: (line) =>
                line.is_plan_fee ? (
                  <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <LockKeyhole size={14} aria-hidden="true" />
                    Locked plan fee
                  </span>
                ) : editable ? (
                  <details>
                    <summary className="text-primary">Edit line</summary>
                    <div className="mt-4 min-w-64">
                      <Phase2Form
                        action={saveSubscriptionLine}
                        fields={fields}
                        initial={{
                          product_id: String(line.product_id),
                          variant_id: String(line.variant_id ?? ""),
                          quantity: String(line.quantity),
                        }}
                        labels={{
                          product_id: line.description,
                          variant_id: line.variant_id
                            ? (line.description.match(/\(([^()]*)\)$/)?.[1] ??
                              "")
                            : "",
                        }}
                        hidden={{
                          subscription_id: String(id.data),
                          id: String(line.id),
                        }}
                        lookups={{
                          product_id: "products",
                          variant_id: "variants",
                        }}
                      />
                      <div className="mt-4">
                        <RecordAction
                          action={removeSubscriptionLine}
                          hidden={{
                            subscription_id: String(id.data),
                            id: String(line.id),
                          }}
                          label="Remove line"
                          confirm
                        />
                      </div>
                    </div>
                  </details>
                ) : (
                  "Read-only"
                ),
            },
          ]}
        />
        <dl className="mt-6 ml-auto grid max-w-sm grid-cols-2 gap-x-8 gap-y-3 text-sm tabular-nums">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="text-right">
            {formatMoney(fromCents(totals.subtotal))}
          </dd>
          <dt className="text-muted-foreground">Tax</dt>
          <dd className="text-right">{formatMoney(fromCents(totals.tax))}</dd>
          <dt className="border-t pt-3 font-semibold">Total per period</dt>
          <dd className="border-t pt-3 text-right font-semibold">
            {formatMoney(fromCents(totals.total))}
          </dd>
        </dl>
        {editable && (
          <div className="mt-10 max-w-3xl border-t pt-8">
            <h3 className="mb-5 text-lg font-semibold">Add product line</h3>
            <Phase2Form
              action={saveSubscriptionLine}
              fields={fields}
              initial={{ quantity: String(plan.min_quantity) }}
              hidden={{ subscription_id: String(id.data) }}
              lookups={{ product_id: "products", variant_id: "variants" }}
              submitLabel="Add product line"
            />
          </div>
        )}
      </section>
    </>
  );
}
