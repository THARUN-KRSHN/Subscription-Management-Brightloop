import { PageHeader } from "@/components/PageHeader";
import { DataTable, type Column } from "@/components/DataTable";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { ChipLink } from "@/components/Chip";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { parsePage, type SearchParams, single } from "@/lib/pagination";
import { formatMoney } from "@/lib/money";

type Row = { id: number; paid_on: string; method: string; amount: string; note: string; invoice_id: number; invoice_number: string | null; customer: string };

async function query(params: SearchParams) {
  const admin = createAdminClient();
  const { page, pageSize, from, to } = parsePage(params);
  const method = single(params.method);
  const dfrom = single(params.from);
  const dto = single(params.to);
  let query = admin
    .from("payments")
    .select("id, paid_on, method, amount, note, invoice:invoices(id, number, customer:customers(contact_name,company_name))", { count: "exact" })
    .order("paid_on", { ascending: false })
    .range(from, to);
  if (method) query = query.eq("method", method);
  if (dfrom) query = query.gte("paid_on", dfrom);
  if (dto) query = query.lte("paid_on", dto);
  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  const rows: Row[] = (data || []).map((r: any) => ({
    id: r.id,
    paid_on: r.paid_on,
    method: r.method,
    amount: formatMoney(r.amount),
    note: r.note || "",
    invoice_id: r.invoice?.id,
    invoice_number: r.invoice?.number,
    customer: r.invoice?.customer?.company_name || r.invoice?.customer?.contact_name || "",
  }));
  return { rows, total: count || 0, page, pageSize };
}

export default async function PaymentsPage({ searchParams }: any) {
  await requireRole(["admin", "staff"]);
  const { rows, total, page, pageSize } = await query(searchParams);
  const columns: Column<Row>[] = [
    { label: "Date", render: (r) => r.paid_on },
    { label: "Invoice", render: (r) => <Link className="underline" href={`/admin/invoices/${r.invoice_id}`}>{r.invoice_number ?? r.invoice_id}</Link> },
    { label: "Customer", render: (r) => r.customer },
    { label: "Method", render: (r) => r.method },
    { label: "Amount", render: (r) => r.amount },
    { label: "Note", render: (r) => r.note },
  ];
  return (
    <div className="space-y-6">
      <PageHeader title="Payments" action={<Link className={buttonVariants({ variant: "outline" })} href="/admin/invoices">Invoices</Link>} />
      <div className="flex flex-wrap items-center gap-2">
        <ChipLink href="/admin/payments" label="All" active={!single(searchParams.method)} />
        <ChipLink href="/admin/payments?method=upi" label="UPI" active={single(searchParams.method)==="upi"} />
        <ChipLink href="/admin/payments?method=card" label="Card" active={single(searchParams.method)==="card"} />
        <ChipLink href="/admin/payments?method=bank_transfer" label="Bank transfer" active={single(searchParams.method)==="bank_transfer"} />
        <ChipLink href="/admin/payments?method=cash" label="Cash" active={single(searchParams.method)==="cash"} />
        <ChipLink href="/admin/payments?method=cheque" label="Cheque" active={single(searchParams.method)==="cheque"} />
        <ChipLink href="/admin/payments?method=other" label="Other" active={single(searchParams.method)==="other"} />
      </div>
      <DataTable rows={rows} columns={columns} total={total} page={page} pageSize={pageSize} params={searchParams} pathname="/admin/payments" />
    </div>
  );
}
