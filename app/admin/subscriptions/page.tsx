import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { idSchema } from "@/lib/validation";
import {
  parsePage,
  pagedResult,
  single,
  type SearchParams,
} from "@/lib/pagination";
import {
  subscriptionStatuses,
  type SubscriptionStatus,
} from "@/lib/subscriptions/types";
import { getSubscriptionLines } from "@/lib/subscriptions/data";
import { periodTotals } from "@/lib/subscriptions/calculations";
import { formatMoney, fromCents } from "@/lib/money";
import { PageHeader } from "@/components/PageHeader";
import { ChipLink } from "@/components/Chip";
import { DataTable } from "@/components/DataTable";
import { LookupFilter } from "@/components/LookupFilter";
import { safeSearch, searchPattern } from "@/components/EntityPages";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
type Row = {
  id: number;
  number: string;
  status: SubscriptionStatus;
  start_date: string;
  expiry_date: string;
  customer: { contact_name: string; company_name: string | null } | null;
  plan: { name: string } | null;
};
export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireRole(["admin", "staff"]);
  const params = await searchParams;
  const pagination = parsePage(params);
  const q = safeSearch(single(params.q));
  const rawStatus = single(params.status);
  const status = subscriptionStatuses.includes(rawStatus as SubscriptionStatus)
    ? rawStatus
    : "";
  const customerId = idSchema.safeParse(single(params.customer));
  const planId = idSchema.safeParse(single(params.plan));
  let query = createAdminClient()
    .from("subscriptions")
    .select(
      "id,number,status,start_date,expiry_date,customer:customers(contact_name,company_name),plan:plans(name)",
      { count: "exact" },
    );
  if (q) query = query.ilike("number", searchPattern(q));
  if (status) query = query.eq("status", status);
  if (customerId.success) query = query.eq("customer_id", customerId.data);
  if (planId.success) query = query.eq("plan_id", planId.data);
  const { data, count, error } = await query
    .order("id", { ascending: false })
    .range(pagination.from, pagination.to);
  if (error) throw new Error("Could not load subscriptions.");
  const rows = (data ?? []) as unknown as Row[];
  const totals = new Map(
    await Promise.all(
      rows.map(
        async (row) =>
          [
            row.id,
            periodTotals(await getSubscriptionLines(row.id)).total,
          ] as const,
      ),
    ),
  );
  return (
    <>
      <PageHeader
        title="Subscriptions"
        description="Build quotations, manage lifecycle status, and review recurring period totals."
        action={
          <Link href="/admin/subscriptions/new" className={buttonVariants()}>
            New subscription
          </Link>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <ChipLink href="/admin/subscriptions" label="All" active={!status} />
        {subscriptionStatuses.map((st) => (
          <ChipLink key={st} href={`/admin/subscriptions?status=${st}`} label={st} active={status===st} />
        ))}
      </div>
      <form method="get" className="mb-6 flex flex-wrap items-start gap-4">
        <label
          className="field min-w-48 flex-1 sm:max-w-xs"
          htmlFor="number-search"
        >
          Subscription number
          <Input
            id="number-search"
            name="q"
            defaultValue={q}
            placeholder="SUB-2026-…"
            maxLength={100}
          />
        </label>
        <label className="field" htmlFor="status-filter">
          Status
          <select id="status-filter" name="status" defaultValue={status}>
            <option value="">All statuses</option>
            {subscriptionStatuses.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <LookupFilter
          key={`customer-${single(params.customer)}`}
          kind="customers"
          name="customer"
          label="Customer"
          initialValue={customerId.success ? String(customerId.data) : ""}
        />
        <LookupFilter
          key={`plan-${single(params.plan)}`}
          kind="plans"
          name="plan"
          label="Plan"
          initialValue={planId.success ? String(planId.data) : ""}
        />
        <label className="field" htmlFor="pageSize">
          Per page
          <select
            id="pageSize"
            name="pageSize"
            defaultValue={String(pagination.pageSize)}
          >
            {[...new Set([20, 50, 100, pagination.pageSize])]
              .sort((a, b) => a - b)
              .map((size) => (
                <option key={size}>{size}</option>
              ))}
          </select>
        </label>
        <div className="flex gap-3 pt-7">
          <Button variant="outline">Apply filters</Button>
          <Link
            href="/admin/subscriptions"
            className="py-2 text-sm text-primary underline"
          >
            Clear
          </Link>
        </div>
      </form>
      <DataTable
        {...pagedResult(rows, count ?? 0, pagination.page, pagination.pageSize)}
        params={params}
        pathname="/admin/subscriptions"
        columns={[
          {
            label: "Number",
            render: (row) => (
              <Link
                href={`/admin/subscriptions/${row.id}`}
                className="font-medium text-primary underline"
              >
                {row.number}
              </Link>
            ),
          },
          {
            label: "Customer",
            render: (row) =>
              row.customer?.company_name || row.customer?.contact_name || "—",
          },
          { label: "Plan", render: (row) => row.plan?.name ?? "—" },
          {
            label: "Status",
            render: (row) => (
              <Badge
                className={
                  row.status === "active"
                    ? "bg-emerald-50 text-emerald-800 capitalize"
                    : "capitalize"
                }
              >
                {row.status}
              </Badge>
            ),
          },
          { label: "Start", render: (row) => row.start_date },
          { label: "Expiry", render: (row) => row.expiry_date },
          {
            label: "Per period (incl. tax)",
            render: (row) => formatMoney(fromCents(totals.get(row.id) ?? 0)),
          },
        ]}
      />
    </>
  );
}
