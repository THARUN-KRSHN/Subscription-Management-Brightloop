import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  parsePage,
  pagedResult,
  single,
  type SearchParams,
} from "@/lib/pagination";
import { discountStatus } from "@/lib/subscriptions/calculations";
import { formatMoney } from "@/lib/money";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import {
  ListFilters,
  Notice,
  safeSearch,
  searchPattern,
} from "@/components/EntityPages";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
type Row = {
  id: number;
  name: string;
  kind: string;
  value: string | number;
  scope: string;
  starts_on: string;
  ends_on: string | null;
  usage_limit: number | null;
  used_count: number;
  is_active: boolean;
};
export default async function DiscountsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireRole(["admin"]);
  const params = await searchParams;
  const pagination = parsePage(params);
  const q = safeSearch(single(params.q));
  let query = createAdminClient()
    .from("discounts")
    .select(
      "id,name,kind,value,scope,starts_on,ends_on,usage_limit,used_count,is_active",
      { count: "exact" },
    );
  if (q) query = query.ilike("name", searchPattern(q));
  const { data, count, error } = await query
    .order("id", { ascending: false })
    .range(pagination.from, pagination.to);
  if (error) throw new Error("Could not load discounts.");
  return (
    <>
      <PageHeader
        title="Discounts"
        description="Define automatic discount rules. Discounts will be applied by the billing engine in Phase 3."
        action={
          <Link href="/admin/discounts/new" className={buttonVariants()}>
            Add discount
          </Link>
        }
      />
      <Notice params={params} />
      <ListFilters
        q={q}
        active=""
        showActive={false}
        pageSize={pagination.pageSize}
      />
      <DataTable
        {...pagedResult(
          (data ?? []) as Row[],
          count ?? 0,
          pagination.page,
          pagination.pageSize,
        )}
        params={params}
        pathname="/admin/discounts"
        columns={[
          {
            label: "Name",
            render: (row) => <span className="font-medium">{row.name}</span>,
          },
          {
            label: "Value",
            render: (row) =>
              row.kind === "percentage"
                ? `${row.value}%`
                : formatMoney(row.value),
          },
          { label: "Scope", render: (row) => row.scope },
          {
            label: "Dates",
            render: (row) =>
              `${row.starts_on} → ${row.ends_on || "No end date"}`,
          },
          {
            label: "Usage",
            render: (row) =>
              `${row.used_count} / ${row.usage_limit ?? "Unlimited"}`,
          },
          {
            label: "Status",
            render: (row) => (
              <Badge className="capitalize">{discountStatus(row)}</Badge>
            ),
          },
          {
            label: "Actions",
            render: (row) => (
              <Link
                href={`/admin/discounts/${row.id}`}
                className="text-primary underline"
              >
                Edit
              </Link>
            ),
          },
        ]}
      />
    </>
  );
}
