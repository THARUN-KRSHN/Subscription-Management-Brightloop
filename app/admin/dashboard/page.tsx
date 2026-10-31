import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { parsePage, type SearchParams, single } from "@/lib/pagination";
import { formatMoney } from "@/lib/money";
import { Card, StatNumber } from "@/components/Card";
import { ChartCard } from "@/components/ChartCard";
import Link from "next/link";
import { DataTable, type Column } from "@/components/DataTable";

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 89);
  const f = from.toISOString().slice(0,10);
  const t = to.toISOString().slice(0,10);
  return { from: f, to: t };
}

export default async function Dashboard({ searchParams }: any) {
  await requireRole(["admin", "staff"]);
  const admin = createAdminClient();
  const { from: defFrom, to: defTo } = defaultRange();
  const from = single(searchParams.from) || defFrom;
  const to = single(searchParams.to) || defTo;
  const customer = single(searchParams.customer);
  const plan = single(searchParams.plan);

  const [{ data: summary }, { data: series }] = await Promise.all([
    admin.rpc("dashboard_summary", { p_from: from, p_to: to, p_customer: customer ? Number(customer) : null, p_plan: plan ? Number(plan) : null }),
    admin.rpc("dashboard_revenue_by_month", { p_from: from, p_to: to, p_customer: customer ? Number(customer) : null, p_plan: plan ? Number(plan) : null }),
  ]);
  const s = Array.isArray(summary) ? summary[0] : summary;
  const chart = Array.isArray(series) ? series.map((d: any) => ({ month: d.month, invoiced: Number(d.invoiced || 0), received: Number(d.received || 0) })) : [];

  // Overdue invoices table
  const { page, pageSize, from: rFrom, to: rTo } = parsePage(searchParams);
  let overdue = admin
    .from("invoices")
    .select("id, number, due_date, total, amount_paid, customer:customers(contact_name,company_name)", { count: "exact" })
    .eq("status", "confirmed")
    .lt("due_date", new Date().toISOString().slice(0,10))
    .lt("amount_paid", admin.rpc as any)
    .order("due_date")
    .range(rFrom, rTo);
  if (customer) overdue = overdue.eq("customer_id", Number(customer));
  const { data: overdueRows, count: overdueTotal } = await overdue;
  const overdueMapped = (overdueRows || []).map((r: any) => ({
    id: r.id,
    invoice: r.number,
    customer: r.customer?.company_name || r.customer?.contact_name || "",
    due: r.due_date,
    balance: formatMoney(Number(r.total) - Number(r.amount_paid)),
  }));
  const overCols: Column<any>[] = [
    { label: "Invoice", render: (r) => <Link className="underline" href={`/admin/invoices/${r.id}`}>{r.invoice}</Link> },
    { label: "Customer", render: (r) => r.customer },
    { label: "Due", render: (r) => r.due },
    { label: "Balance", render: (r) => r.balance },
  ];

  // Recent payments table
  let pays = admin
    .from("payments")
    .select("id, paid_on, amount, method, invoice:invoices(id, number, customer:customers(contact_name,company_name))", { count: "exact" })
    .gte("paid_on", from)
    .lte("paid_on", to)
    .order("paid_on", { ascending: false })
    .range(rFrom, rTo);
  if (customer) pays = pays.eq("invoice.customer_id", Number(customer));
  const { data: payRows, count: payTotal } = await pays;
  const payMapped = (payRows || []).map((r: any) => ({
    id: r.id,
    date: r.paid_on,
    invoiceId: r.invoice?.id,
    invoice: r.invoice?.number,
    customer: r.invoice?.customer?.company_name || r.invoice?.customer?.contact_name || "",
    method: r.method,
    amount: formatMoney(r.amount),
  }));
  const payCols: Column<any>[] = [
    { label: "Date", render: (r) => r.date },
    { label: "Invoice", render: (r) => <Link className="underline" href={`/admin/invoices/${r.invoiceId}`}>{r.invoice}</Link> },
    { label: "Customer", render: (r) => r.customer },
    { label: "Method", render: (r) => r.method },
    { label: "Amount", render: (r) => r.amount },
  ];

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Finance dashboard</h1>
      <form className="flex flex-wrap items-end gap-3 text-sm">
        <label className="grid gap-1">
          <span>From</span>
          <input type="date" name="from" defaultValue={from} className="rounded border px-2 py-1" />
        </label>
        <label className="grid gap-1">
          <span>To</span>
          <input type="date" name="to" defaultValue={to} className="rounded border px-2 py-1" />
        </label>
        <button className="rounded border px-3 py-1.5">Apply</button>
      </form>
      <section className="grid gap-4 sm:grid-cols-4">
        <Card><p className="text-xs text-muted-foreground">Active</p><StatNumber value={s?.active_subscriptions ?? 0} /></Card>
        <Card><p className="text-xs text-muted-foreground">Paused</p><StatNumber value={s?.paused_subscriptions ?? 0} /></Card>
        <Card><p className="text-xs text-muted-foreground">Invoiced</p><StatNumber value={formatMoney(s?.invoiced_in_range ?? 0)} /></Card>
        <Card><p className="text-xs text-muted-foreground">Received</p><StatNumber value={formatMoney(s?.revenue_received ?? 0)} /></Card>
        <Card><p className="text-xs text-muted-foreground">Outstanding</p><StatNumber value={formatMoney(s?.outstanding_amount ?? 0)} /></Card>
        <Card><p className="text-xs text-muted-foreground">Overdue count</p><StatNumber value={s?.overdue_count ?? 0} /></Card>
        <Card><p className="text-xs text-muted-foreground">Overdue amount</p><StatNumber value={formatMoney(s?.overdue_amount ?? 0)} /></Card>
        <Card><p className="text-xs text-muted-foreground">MRR</p><StatNumber value={formatMoney(s?.mrr ?? 0)} /></Card>
      </section>
      <section className="grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-medium">Overdue invoices</h2>
          <DataTable rows={overdueMapped} columns={overCols} total={overdueTotal || 0} page={page} pageSize={pageSize} params={searchParams} pathname="/admin/dashboard" />
        </div>
        <div>
          <ChartCard data={chart} />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium">Recent payments</h2>
        <DataTable rows={payMapped} columns={payCols} total={payTotal || 0} page={page} pageSize={pageSize} params={searchParams} pathname="/admin/dashboard" />
      </section>
    </div>
  );
}
