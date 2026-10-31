import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  parsePage,
  pagedResult,
  single,
  type SearchParams,
} from "@/lib/pagination";
import { PageHeader } from "@/components/PageHeader";
import { StaffForm } from "@/components/StaffForm";
import { DataTable } from "@/components/DataTable";
import { Notice, safeSearch, searchPattern, ListFilters } from "@/components/EntityPages";
import { StatusBadge } from "@/components/StatusBadge";
export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireRole(["admin"]);
  const params = await searchParams;
  const pagination = parsePage(params);
  const q = safeSearch(single(params.q));
  let query = createAdminClient()
    .from("profiles")
    .select("id,full_name,email,role,is_active", { count: "exact" })
    .in("role", ["admin", "staff"]);
  if (q) query = query.or(`full_name.ilike.${JSON.stringify(searchPattern(q))},email.ilike.${JSON.stringify(searchPattern(q))}`);
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .order("id")
    .range(pagination.from, pagination.to);
  if (error) throw new Error("Could not load staff.");
  return (
    <>
      <PageHeader
        title="Team"
        description="Manage the people who work in your Brightloop workspace. Only administrators can add staff."
      />
      <Notice params={params} />
      <ListFilters q={q} active="" showActive={false} pageSize={pagination.pageSize} />
      <DataTable
        {...pagedResult(
          data ?? [],
          count ?? 0,
          pagination.page,
          pagination.pageSize,
        )}
        params={params}
        pathname="/admin/staff"
        columns={[
          { label: "Name", render: (row) => row.full_name || "—" },
          { label: "Email", render: (row) => row.email },
          {
            label: "Role",
            render: (row) => <span className="capitalize">{row.role}</span>,
          },
          {
            label: "Status",
            render: (row) => (
              <StatusBadge
                active={row.is_active}
                status={row.is_active ? "Active" : "Inactive"}
              />
            ),
          },
        ]}
      />
      <section className="mt-12 border-t pt-8">
        <h2 className="mb-6 text-xl font-semibold">Add staff</h2>
        <StaffForm />
      </section>
    </>
  );
}
