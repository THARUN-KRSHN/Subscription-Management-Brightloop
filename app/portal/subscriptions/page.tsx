import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { DataTable, type Column } from "@/components/DataTable";
import { parsePage, type SearchParams } from "@/lib/pagination";

type Row = { id: number; number: string; plan: string; status: string; start_date: string; expiry_date: string };

export default async function PortalSubscriptions({ searchParams }: any) {
  const user = await requireRole(["customer"]);
  const admin = createAdminClient();
  const { page, pageSize, from, to } = parsePage(searchParams);
  const { data, count, error } = await admin
    .from("subscriptions")
    .select("id, number, status, start_date, expiry_date, plan:plans(name)", { count: "exact" })
    .eq("customer_id", user.customerId)
    .order("id", { ascending: false })
    .range(from, to);
  if (error) throw new Error(error.message);
  const rows: Row[] = (data || []).map((r: any) => ({
    id: r.id,
    number: r.number,
    plan: r.plan?.name || "",
    status: r.status,
    start_date: r.start_date,
    expiry_date: r.expiry_date,
  }));
  const columns: Column<Row>[] = [
    { label: "Number", render: (r) => <Link className="underline" href={`/portal/subscriptions/${r.id}`}>{r.number}</Link> },
    { label: "Plan", render: (r) => r.plan },
    { label: "Status", render: (r) => r.status },
    { label: "Start", render: (r) => r.start_date },
    { label: "Expiry", render: (r) => r.expiry_date },
  ];
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Your subscriptions</h1>
      <DataTable rows={rows} columns={columns} total={count || 0} page={page} pageSize={pageSize} params={searchParams} pathname="/portal/subscriptions" />
    </div>
  );
}
