import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMoney } from "@/lib/money";
import { PrintButton } from "@/components/PrintButton";

export default async function PrintInvoice({ params }: any) {
  await requireRole(["admin", "staff"]);
  const admin = createAdminClient();
  const id = Number(params.id);
  const { data: inv } = await admin
    .from("invoices")
    .select("id, number, status, invoice_date, due_date, subtotal, discount_total, tax_total, total, amount_paid, period_start, period_end, customer:customers(contact_name,company_name,address,email)")
    .eq("id", id)
    .maybeSingle();
  const { data: lines } = await admin
    .from("invoice_lines")
    .select("id, description, quantity, unit_price, discount_amount, tax_amount, tax_pct, amount")
    .eq("invoice_id", id)
    .order("id");
  if (!inv) notFound();
  return (
    <div className="mx-auto max-w-3xl p-6 print:p-0">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-semibold">Invoice {inv.number ?? "(draft)"}</h1>
        <PrintButton className="rounded bg-primary px-4 py-2 text-white">Print</PrintButton>
      </div>
      <div className="rounded border p-6 print:border-0">
        <header className="mb-6 grid gap-1 text-sm">
          <p className="font-medium">Brightloop Software</p>
          <p>Status: {inv.status}</p>
          <p>Invoice date: {inv.invoice_date} · Due: {inv.due_date}</p>
          <p>Period: {inv.period_start} → {inv.period_end}</p>
        </header>
        <section className="mb-6 text-sm">
          <h2 className="mb-1 font-medium">Bill to</h2>
          <p>{inv.customer?.[0]?.company_name || inv.customer?.[0]?.contact_name}</p>
          {inv.customer?.[0]?.address && <p className="whitespace-pre-wrap">{inv.customer?.[0]?.address}</p>}
          <p>{inv.customer?.[0]?.email}</p>
        </section>
        <section className="mb-6 overflow-hidden rounded border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/60 text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Description</th>
                <th className="px-4 py-2">Qty</th>
                <th className="px-4 py-2">Unit</th>
                <th className="px-4 py-2">Discount</th>
                <th className="px-4 py-2">Tax</th>
                <th className="px-4 py-2">Total</th>
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
        <footer className="ml-auto grid max-w-xs gap-1 text-sm">
          <p>Subtotal: {formatMoney(inv.subtotal)}</p>
          <p>Discount: {formatMoney(inv.discount_total)}</p>
          <p>Tax: {formatMoney(inv.tax_total)}</p>
          <p className="font-semibold">Total: {formatMoney(inv.total)}</p>
          <p>Paid: {formatMoney(inv.amount_paid)}</p>
          <p>Balance: {formatMoney(Number(inv.total) - Number(inv.amount_paid))}</p>
        </footer>
      </div>
      <style>{`@media print { .print\\:hidden{display:none} body{background:white} }`}</style>
    </div>
  );
}
