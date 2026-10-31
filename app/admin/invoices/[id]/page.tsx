import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMoney } from "@/lib/money";
import { RecordAction } from "@/components/RecordAction";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/Card";
import { cancelInvoice, confirmInvoice, markSent, recordPayment } from "../actions";
import { ConfirmAction } from "@/components/ConfirmAction";
import { Breadcrumbs } from "@/components/Breadcrumbs";

async function recordPaymentAction(formData: FormData) {
  "use server";
  await recordPayment({}, formData);
}

export default async function InvoiceDetail({ params }: any) {
  await requireRole(["admin", "staff"]);
  const admin = createAdminClient();
  const id = Number(params.id);
  const { data: inv, error } = await admin
    .from("invoices")
    .select(
      "id, number, status, invoice_date, due_date, subtotal, discount_total, tax_total, total, amount_paid, sent_at, period_start, period_end, customer:customers(id,contact_name,company_name,email,address), subscription:subscriptions(number), discount:discounts(name)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !inv) notFound();

  const { data: lines } = await admin
    .from("invoice_lines")
    .select("id, description, quantity, unit_price, discount_amount, tax_pct, tax_amount, amount")
    .eq("invoice_id", id)
    .order("id");
  const { data: payments } = await admin
    .from("payments")
    .select("id, method, amount, paid_on, note")
    .eq("invoice_id", id)
    .order("paid_on", { ascending: false });

  const balance = Number(inv.total) - Number(inv.amount_paid);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ href: "/admin", label: "Admin" }, { href: "/admin/invoices", label: "Invoices" }, { label: inv.number ?? "(draft)" }]} />
      <PageHeader
        title={`Invoice ${inv.number ?? "(draft)"}`}
        description={`Subscription ${inv.subscription?.[0]?.number ?? ""} · Period ${inv.period_start} → ${inv.period_end}`}
        action={
          <div className="flex flex-wrap gap-2">
            {inv.status === "draft" && (
              <RecordAction action={confirmInvoice} hidden={{ id: String(inv.id) }} label="Confirm" />
            )}
            {(inv.status === "draft" || (inv.status === "confirmed" && Number(inv.amount_paid) === 0)) && (
              <ConfirmAction action={cancelInvoice} hidden={{ id: String(inv.id) }} label="Cancel" message="Cancel this invoice? This cannot be undone." destructive />
            )}
            {inv.status === "confirmed" && (
              <RecordAction action={markSent} hidden={{ id: String(inv.id) }} label={inv.sent_at ? "Resend/mark sent" : "Send"} />
            )}
            <Link className={buttonVariants({ variant: "outline" })} href={`/admin/invoices/${inv.id}/print`} target="_blank">Print</Link>
          </div>
        }
      />

      <section className="grid gap-2">
        <h2 className="text-lg font-medium">Customer</h2>
        <Card className="text-sm">
          <p className="font-medium">{inv.customer?.[0]?.company_name || inv.customer?.[0]?.contact_name}</p>
          <p>{inv.customer?.[0]?.email}</p>
          {inv.customer?.[0]?.address && <p className="whitespace-pre-wrap text-muted-foreground">{inv.customer?.[0]?.address}</p>}
        </Card>
      </section>

      <section className="grid gap-2">
        <h2 className="text-lg font-medium">Lines</h2>
        <Card className="overflow-hidden p-0">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/60 text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Description</th>
                <th className="px-4 py-2">Qty</th>
                <th className="px-4 py-2">Unit</th>
                <th className="px-4 py-2">Discount</th>
                <th className="px-4 py-2">Tax</th>
                <th className="px-4 py-2">Line total</th>
              </tr>
            </thead>
            <tbody>
              {(lines || []).map((l) => (
                <tr key={l.id} className="border-t">
                  <td className="px-4 py-2">{l.description}</td>
                  <td className="px-4 py-2">{l.quantity}</td>
                  <td className="px-4 py-2">{formatMoney(l.unit_price)}</td>
                  <td className="px-4 py-2">{formatMoney(l.discount_amount)}</td>
                  <td className="px-4 py-2">{formatMoney(l.tax_amount)} ({l.tax_pct}%)</td>
                  <td className="px-4 py-2">{formatMoney(Number(l.amount) - Number(l.discount_amount) + Number(l.tax_amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      <section className="grid gap-2 md:grid-cols-2">
        <Card className="text-sm">
          <h3 className="mb-2 font-medium">Summary</h3>
          {inv.discount?.[0]?.name && <p>Discount: {inv.discount?.[0]?.name}</p>}
          <p>Invoice date: {inv.invoice_date}</p>
          <p>Due date: {inv.due_date}</p>
          <p>Status: {inv.status}</p>
        </Card>
        <Card className="text-sm">
          <h3 className="mb-2 font-medium">Totals</h3>
          <p>Subtotal: {formatMoney(inv.subtotal)}</p>
          <p>Discount: {formatMoney(inv.discount_total)}</p>
          <p>Tax: {formatMoney(inv.tax_total)}</p>
          <p className="font-medium">Total: {formatMoney(inv.total)}</p>
          <p>Paid: {formatMoney(inv.amount_paid)}</p>
          <p className="font-semibold">Balance: {formatMoney(balance)}</p>
        </Card>
      </section>

      <section className="grid gap-2">
        <h2 className="text-lg font-medium">Payments</h2>
        {payments && payments.length > 0 ? (
          <Card className="overflow-hidden p-0">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/60 text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Method</th>
                  <th className="px-4 py-2">Amount</th>
                  <th className="px-4 py-2">Note</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-4 py-2">{p.paid_on}</td>
                    <td className="px-4 py-2">{p.method}</td>
                    <td className="px-4 py-2">{formatMoney(p.amount)}</td>
                    <td className="px-4 py-2">{p.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ) : (
          <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
        )}
      </section>

      {inv.status === "confirmed" && balance > 0 && (
        <section className="grid gap-2">
          <h2 className="text-lg font-medium">Record payment</h2>
          <form action={recordPaymentAction} className="grid max-w-md gap-3 rounded border p-4">
            <input type="hidden" name="id" value={String(inv.id)} />
            <label className="grid gap-1 text-sm">
              <span>Method</span>
              <select name="method" className="rounded border p-2">
                <option value="bank_transfer">Bank transfer</option>
                <option value="card">Card</option>
                <option value="upi">UPI</option>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span>Amount</span>
              <input name="amount" type="number" step="0.01" min="0.01" max={String(balance)} defaultValue={String(balance)} className="rounded border p-2" />
            </label>
            <label className="grid gap-1 text-sm">
              <span>Date</span>
              <input name="paid_on" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="rounded border p-2" />
            </label>
            <label className="grid gap-1 text-sm">
              <span>Note</span>
              <input name="note" type="text" placeholder="Optional" className="rounded border p-2" />
            </label>
            <button className={buttonVariants({ variant: "default" })}>Record payment</button>
          </form>
        </section>
      )}
    </div>
  );
}
