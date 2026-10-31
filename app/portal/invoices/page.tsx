import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { DataTable, type Column } from "@/components/DataTable";
import { parsePage, type SearchParams } from "@/lib/pagination";
import { formatMoney } from "@/lib/money";

type Row = { id: number; number: string; invoice_date: string; due_date: string; total: string; balance: string; status: string; overdue: boolean };

export default async function PortalInvoices({ searchParams }: any) {
  const user = await requireRole(["customer"]);
  const admin = createAdminClient();
  const { page, pageSize, from, to } = parsePage(searchParams);
  const { data, count, error } = await admin
    .from("invoices")
    .select("id, number, invoice_date, due_date, total, amount_paid, status")
    .eq("customer_id", user.customerId)
    .neq("status", "draft")
    .order("invoice_date", { ascending: false })
    .range(from, to);
  if (error) throw new Error(error.message);
  const rows: Row[] = (data || []).map((r: any) => ({
    id: r.id,
    number: r.number,
    invoice_date: r.invoice_date,
    due_date: r.due_date,
    total: formatMoney(r.total),
    balance: formatMoney(Number(r.total) - Number(r.amount_paid)),
    status: r.status,
    overdue: r.status === "confirmed" && r.due_date < new Date().toISOString().slice(0,10) && Number(r.amount_paid) < Number(r.total),
  }));
  const columns: Column<Row>[] = [
    { label: "Number", render: (r) => <Link className="underline" href={`/portal/invoices/${r.id}`}>{r.number}</Link> },
    { label: "Date", render: (r) => r.invoice_date },
    { label: "Due", render: (r) => r.due_date },
    { label: "Total", render: (r) => r.total, align: "right" },
    { label: "Balance", render: (r) => r.balance, align: "right" },
    { label: "Status", render: (r) => <span className="inline-flex items-center gap-2">{r.status}{r.overdue ? <span className="text-xs text-destructive"> · Overdue</span> : null}</span> },
  ];
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Your invoices</h1>
      <DataTable rows={rows} columns={columns} total={count || 0} page={page} pageSize={pageSize} params={searchParams} pathname="/portal/invoices" />
    </div>
  );
}
