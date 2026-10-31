import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  parsePage,
  pagedResult,
  single,
  type SearchParams,
} from "@/lib/pagination";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import {
  ListFilters,
  safeSearch,
  searchPattern,
} from "@/components/EntityPages";
import { buttonVariants } from "@/components/ui/button";
type Row = {
  id: number;
  name: string;
  validity_days: number;
  plan: { name: string } | null;
};
export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const actor = await requireRole(["admin", "staff"]);
  const params = await searchParams;
  const pagination = parsePage(params);
  const q = safeSearch(single(params.q));
  let query = createAdminClient()
    .from("quotation_templates")
    .select("id,name,validity_days,plan:plans(name)", { count: "exact" });
  if (q) query = query.ilike("name", searchPattern(q));
  const { data, error, count } = await query
    .order("id", { ascending: false })
    .range(pagination.from, pagination.to);
  if (error) throw new Error("Could not load quotation templates.");
  return (
    <>
      <PageHeader
        title="Quotation templates"
        description="Reusable plans and product lines for new subscriptions. Staff can view and use templates; only admins can change them."
        action={
          actor.role === "admin" ? (
            <Link
              href="/admin/quotation-templates/new"
              className={buttonVariants()}
            >
              Add template
            </Link>
          ) : undefined
        }
      />
      <ListFilters
        q={q}
        active=""
        showActive={false}
        pageSize={pagination.pageSize}
      />
      <DataTable
        {...pagedResult(
          (data ?? []) as unknown as Row[],
          count ?? 0,
          pagination.page,
          pagination.pageSize,
        )}
        pathname="/admin/quotation-templates"
        params={params}
        columns={[
          {
            label: "Name",
            render: (row) => <span className="font-medium">{row.name}</span>,
          },
          { label: "Plan", render: (row) => row.plan?.name ?? "—" },
          {
            label: "Quote validity",
            render: (row) => `${row.validity_days} days`,
          },
          {
            label: "Actions",
            render: (row) => (
              <Link
                className="text-primary underline"
                href={`/admin/quotation-templates/${row.id}`}
              >
                {actor.role === "admin" ? "Edit" : "View"}
              </Link>
            ),
          },
        ]}
      />
    </>
  );
}
