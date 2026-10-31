import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type Column } from "@/components/DataTable";
import { buttonVariants } from "@/components/ui/button";
import { ChipLink } from "@/components/Chip";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { parsePage, type SearchParams, single } from "@/lib/pagination";
import { formatMoney } from "@/lib/money";
import { RecordAction } from "@/components/RecordAction";
import { ConfirmAction } from "@/components/ConfirmAction";
import { runBilling, bulkConfirmDrafts } from "./actions";

type Row = {
  id: number;
  number: string | null;
  customer: string;
  subscription_number: string;
  period: string;
  due_date: string;
  total: string;
  amount_paid: string;
  status: string;
  overdue: boolean;
};

async function query(params: SearchParams) {
  const admin = createAdminClient();
  const { page, pageSize, from, to } = parsePage(params);
  const q = single(params.q);
  const status = single(params.status);
  const customer = single(params.customer);
  const overdue = single(params.overdue) === "1";
  const dateFrom = single(params.from);
  const dateTo = single(params.to);

  let query = admin
    .from("invoices")
    .select(
      "id, number, invoice_date, due_date, total, amount_paid, status, customer:customers(contact_name,company_name), subscription:subscriptions(number), period_start, period_end",
      { count: "exact" },
    )
    .order("invoice_date", { ascending: false })
    .range(from, to);

  if (status) query = query.eq("status", status);
  if (customer && /^\d+$/.test(customer)) query = query.eq("customer_id", Number(customer));
  if (overdue) query = query.eq("status", "confirmed").lt("due_date", new Date().toISOString().slice(0, 10));
  if (dateFrom) query = query.gte("invoice_date", dateFrom);
  if (dateTo) query = query.lte("invoice_date", dateTo);
  if (q) query = query.or(
    [
      `number.ilike.%${q}%`,
      `subscription.number.ilike.%${q}%`,
      `customers.contact_name.ilike.%${q}%`,
      `customers.company_name.ilike.%${q}%`,
    ].join(","),
  );

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  let rows: Row[] = (data || []).map((r: any) => ({
    id: r.id,
    number: r.number,
    customer: r.customer?.[0]?.company_name || r.customer?.[0]?.contact_name || "",
    subscription_number: r.subscription?.[0]?.number || "",
    period: `${r.period_start} → ${r.period_end}`,
    due_date: r.due_date,
    total: formatMoney(r.total),
    amount_paid: formatMoney(r.amount_paid),
    status: r.status,
    overdue: r.status === "confirmed" && r.due_date < new Date().toISOString().slice(0, 10) && Number(r.amount_paid) < Number(r.total),
  }));
  if (overdue) rows = rows.filter((r) => r.overdue);
  return { rows, total: count || 0, page, pageSize };
}

export default async function InvoicesPage({ searchParams }: any) {
  await requireRole(["admin", "staff"]);
  const { rows, total, page, pageSize } = await query(searchParams);

  const columns: Column<Row>[] = [
    { label: "Number", render: (r) => (
      <Link className="underline" href={`/admin/invoices/${r.id}`}>{r.number ?? "(draft)"}</Link>
    ) },
    { label: "Customer", render: (r) => r.customer },
    { label: "Subscription", render: (r) => r.subscription_number },
    { label: "Period", render: (r) => r.period },
    { label: "Due", render: (r) => r.due_date },
    { label: "Total", render: (r) => r.total, align: "right" },
    { label: "Paid", render: (r) => r.amount_paid, align: "right" },
    { label: "Status", render: (r) => <span className="inline-flex items-center gap-2">{r.status}{r.overdue ? <span className="text-xs text-destructive"> · Overdue</span> : null}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        action={
          <div className="flex gap-2">
            <ConfirmAction action={runBilling} hidden={{}} label="Run billing" message="Run billing? This cannot be undone." destructive />
            <RecordAction action={bulkConfirmDrafts} hidden={{}} label="Confirm all drafts" />
            <Link className={buttonVariants({ variant: "outline" })} href="/admin/payments">Payments</Link>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <ChipLink href="/admin/invoices" label="All" active={!single(searchParams.status) && !single(searchParams.overdue)} />
        <ChipLink href="/admin/invoices?status=draft" label="Draft" active={single(searchParams.status) === "draft"} />
        <ChipLink href="/admin/invoices?status=confirmed" label="Confirmed" active={single(searchParams.status) === "confirmed" && !single(searchParams.overdue)} />
        <ChipLink href="/admin/invoices?status=paid" label="Paid" active={single(searchParams.status) === "paid"} />
        <ChipLink href="/admin/invoices?status=cancelled" label="Cancelled" active={single(searchParams.status) === "cancelled"} />
        <ChipLink href="/admin/invoices?overdue=1" label="Overdue" active={single(searchParams.overdue) === "1"} />
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        total={total}
        page={page}
        pageSize={pageSize}
        params={searchParams}
        pathname="/admin/invoices"
        emptyMessage="No invoices yet. Run billing to generate drafts."
      />
    </div>
  );
}
