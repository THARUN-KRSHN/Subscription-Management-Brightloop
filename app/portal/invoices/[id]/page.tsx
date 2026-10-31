import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMoney } from "@/lib/money";

export default async function PortalInvoiceDetail({ params }: any) {
  const user = await requireRole(["customer"]);
  const admin = createAdminClient();
  const id = Number(params.id);
  const { data: inv } = await admin
    .from("invoices")
    .select("id, number, status, invoice_date, due_date, subtotal, discount_total, tax_total, total, amount_paid, period_start, period_end, discount:discounts(name)")
    .eq("id", id)
    .eq("customer_id", user.customerId)
    .neq("status", "draft")
    .maybeSingle();
  if (!inv) notFound();
  const { data: lines } = await admin
    .from("invoice_lines")
    .select("id, description, quantity, unit_price, discount_amount, tax_pct, tax_amount, amount")
    .eq("invoice_id", id)
    .order("id");
  const balance = Number(inv.total) - Number(inv.amount_paid);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Invoice {inv.number}</h1>
        <Link className="rounded border px-3 py-1.5 text-sm" href={`/portal/invoices/${inv.id}/print`} target="_blank">Print</Link>
      </div>
      <div className="grid gap-2 text-sm">
        <p>Invoice date: {inv.invoice_date} · Due: {inv.due_date}</p>
        <p>Period: {inv.period_start} → {inv.period_end}</p>
        {inv.discount?.[0]?.name && <p>Discount: {inv.discount?.[0]?.name}</p>}
      </div>
      <section className="overflow-hidden rounded border">
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
      </section>
      <div className="grid gap-1 text-sm">
        <p>Subtotal: {formatMoney(inv.subtotal)}</p>
        <p>Discount: {formatMoney(inv.discount_total)}</p>
        <p>Tax: {formatMoney(inv.tax_total)}</p>
        <p className="font-semibold">Total: {formatMoney(inv.total)} · Paid: {formatMoney(inv.amount_paid)} · Balance: {formatMoney(balance)}</p>
      </div>
    </div>
  );
}
