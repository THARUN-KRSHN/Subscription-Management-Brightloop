import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMoney } from "@/lib/money";
import { Card } from "@/components/Card";
import { customerTransition } from "./actions";

export default async function PortalSubscriptionDetail({ params }: any) {
  const user = await requireRole(["customer"]);
  const admin = createAdminClient();
  const id = Number(params.id);
  const { data: sub } = await admin
    .from("subscriptions")
    .select("id, number, status, start_date, expiry_date, plan:plans(id,name,allow_pause,allow_early_close)")
    .eq("id", id)
    .eq("customer_id", user.customerId)
    .maybeSingle();
  if (!sub) notFound();
  const { data: lines } = await admin
    .from("subscription_lines")
    .select("id, description, quantity, unit_price, tax_pct, amount, is_plan_fee")
    .eq("subscription_id", id)
    .order("id");
  const plan = Array.isArray(sub.plan) ? sub.plan[0] : sub.plan;
  const canPause = plan?.allow_pause && sub.status === "active";
  const canResume = plan?.allow_pause && sub.status === "paused";
  const canClose = (sub.status === "active" || sub.status === "paused") && plan?.allow_early_close;
  const canAccept = sub.status === "quotation";
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{sub.number}</h1>
      <Card className="grid gap-2 text-sm">
        <p>Plan: {plan?.name}</p>
        <p>Status: {sub.status}</p>
        <p>Start: {sub.start_date} · Expiry: {sub.expiry_date}</p>
      </Card>
      <div className="flex flex-wrap gap-2">
        {canAccept && (
          <form action={async (fd) => customerTransition(fd, "confirm")}>
            <input type="hidden" name="id" value={String(sub.id)} />
            <button className="rounded bg-primary px-3 py-1.5 text-sm text-white">Accept quotation</button>
          </form>
        )}
        {canPause && (
          <form action={async (fd) => customerTransition(fd, "pause")}>
            <input type="hidden" name="id" value={String(sub.id)} />
            <button className="rounded border px-3 py-1.5 text-sm">Pause</button>
          </form>
        )}
        {canResume && (
          <form action={async (fd) => customerTransition(fd, "resume")}>
            <input type="hidden" name="id" value={String(sub.id)} />
            <button className="rounded border px-3 py-1.5 text-sm">Resume</button>
          </form>
        )}
        {canClose && (
          <form action={async (fd) => customerTransition(fd, "close")}>
            <input type="hidden" name="id" value={String(sub.id)} />
            <button className="rounded border px-3 py-1.5 text-sm">Close</button>
          </form>
        )}
      </div>
      <section>
        <Card className="overflow-hidden p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/60 text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Description</th>
              <th className="px-4 py-2">Qty</th>
              <th className="px-4 py-2">Unit</th>
              <th className="px-4 py-2">Tax</th>
              <th className="px-4 py-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(lines || []).map((l) => (
              <tr key={l.id} className="border-t">
                <td className="px-4 py-2">{l.description}{l.is_plan_fee ? " (plan fee)" : ""}</td>
                <td className="px-4 py-2">{l.quantity}</td>
                <td className="px-4 py-2">{formatMoney(l.unit_price)}</td>
                <td className="px-4 py-2">{l.tax_pct}%</td>
                <td className="px-4 py-2">{formatMoney(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </Card>
      </section>
    </div>
  );
}
