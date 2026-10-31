import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMoney } from "@/lib/money";

export default async function PortalPage() {
  const user = await requireRole(["customer"]);
  const admin = createAdminClient();
  const [{ data: activeSubCount }, { data: invs }] = await Promise.all([
    admin
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", user.customerId)
      .eq("status", "active"),
    admin
      .from("invoices")
      .select("total,amount_paid,due_date,status")
      .eq("customer_id", user.customerId)
      .neq("status", "draft")
      .limit(5000),
  ]);
  const active = (activeSubCount as any)?.length ?? (activeSubCount as any)?.count ?? 0;
  const list = (invs || []) as any[];
  const outstanding = list
    .filter((i) => i.status === "confirmed")
    .reduce((sum, i) => sum + Number(i.total) - Number(i.amount_paid), 0);
  const nextDue = list
    .filter((i) => i.status === "confirmed" && Number(i.amount_paid) < Number(i.total))
    .map((i) => i.due_date)
    .sort()[0];
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="mb-6 text-3xl font-semibold tracking-tight">Welcome, {user.fullName || user.email}</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded border p-4">
          <p className="text-xs text-muted-foreground">Active subscriptions</p>
          <p className="mt-1 text-2xl font-semibold">{active}</p>
        </div>
        <div className="rounded border p-4">
          <p className="text-xs text-muted-foreground">Outstanding balance</p>
          <p className="mt-1 text-2xl font-semibold">{formatMoney(outstanding)}</p>
        </div>
        <div className="rounded border p-4">
          <p className="text-xs text-muted-foreground">Next invoice due</p>
          <p className="mt-1 text-2xl font-semibold">{nextDue || "—"}</p>
        </div>
      </div>
    </main>
  );
}
