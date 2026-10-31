import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { entityConfig, type Entity, type EntityRow } from "@/lib/catalogue";
import {
  parsePage,
  pagedResult,
  single,
  type SearchParams,
} from "@/lib/pagination";
import { formatMoney } from "@/lib/money";
import { idSchema } from "@/lib/validation";
import {
  saveCustomer,
  saveCatalogue,
  deleteCatalogue,
  archiveProduct,
  saveVariant,
  deleteVariant,
} from "@/app/admin/actions";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { EntityForm } from "@/components/EntityForm";
import { RecordAction } from "@/components/RecordAction";
import { StatusBadge } from "@/components/StatusBadge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Input } from "@/components/ui/input";

export function safeSearch(value: string) {
  return value.slice(0, 100).replace(/[\u0000-\u001f\u007f]/g, "").trim();
}
export function searchPattern(value: string) {
  return `%${value.replace(/[\\%_]/g, character => `\\${character}`)}%`;
}
export function Notice({ params }: { params: SearchParams }) {
  const message = single(params.message);
  return ["saved", "deleted", "created", "archived"].includes(message) ? (
    <p
      role="status"
      className="mb-6 rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
    >
      {message === "saved"
        ? "Changes saved."
        : message === "deleted"
          ? "Record deleted."
          : message === "archived"
            ? "Product archived."
            : "Staff account created."}
    </p>
  ) : null;
}
export function ListFilters({
  q,
  active,
  showActive,
  pageSize = 20,
}: {
  q: string;
  active: string;
  showActive: boolean;
  pageSize?: number;
}) {
  return (
    <form className="mb-5 flex flex-wrap items-end gap-3" method="get">
      <label className="field flex-1 sm:max-w-sm" htmlFor="search">
        Search
        <Input
          id="search"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Search by name or email…"
          maxLength={100}
        />
      </label>
      {showActive && (
        <label className="field" htmlFor="active">
          Status
          <select id="active" name="active" defaultValue={active}>
            <option value="">All statuses</option>
            <option value="true">Active</option>
            <option value="false">Archived</option>
          </select>
        </label>
      )}
      <label className="field" htmlFor="pageSize">
        Per page
        <select id="pageSize" name="pageSize" defaultValue={String(pageSize)}>
          {[...new Set([20, 50, 100, pageSize])]
            .sort((a, b) => a - b)
            .map((size) => (
              <option key={size}>{size}</option>
            ))}
        </select>
      </label>
      <Button variant="outline" type="submit">
        Apply filters
      </Button>
      <Link className="px-2 py-3 text-sm text-primary underline" href="?">
        Clear
      </Link>
    </form>
  );
}
export async function EntityList({
  entity,
  searchParams,
}: {
  entity: Entity;
  searchParams: Promise<SearchParams>;
}) {
  await requireRole(entity === "customers" ? ["admin", "staff"] : ["admin"]);
  const params = await searchParams;
  const config = entityConfig(entity);
  const pagination = parsePage(params);
  const q = safeSearch(single(params.q));
  const active = single(params.active);
  let query = createAdminClient()
    .from(config.table)
    .select(config.select, { count: "exact" });
  if (q)
    query = query.or(
      config.searchFields.map((field) => `${field}.ilike.${JSON.stringify(searchPattern(q))}`).join(","),
    );
  const showActive = config.fields.some((field) => field.name === "is_active");
  if (showActive && ["true", "false"].includes(active))
    query = query.eq("is_active", active === "true");
  const { data, count, error } = await query
    .order("id", { ascending: false })
    .range(pagination.from, pagination.to);
  if (error)
    throw new Error(
      `Could not load ${entity}. Check that the migration is applied.`,
    );
  const result = pagedResult(
    (data ?? []) as unknown as EntityRow[],
    count ?? 0,
    pagination.page,
    pagination.pageSize,
  );
  return (
    <>
      <PageHeader
        title={config.title}
        description={config.description}
        action={
          <Link className={buttonVariants()} href={`/admin/${entity}/new`}>
            <Plus size={16} aria-hidden="true" />
            Add {config.singular}
          </Link>
        }
      />
      <Notice params={params} />
      <ListFilters
        q={q}
        active={active}
        showActive={showActive}
        pageSize={pagination.pageSize}
      />
      <DataTable
        {...result}
        params={params}
        pathname={`/admin/${entity}`}
        columns={[
          ...config.columns.map((column) => ({
            label: column.label,
            render: (row: EntityRow) =>
              column.key === "is_active" ? (
                <StatusBadge active={!!row.is_active} />
              ) : column.money ? (
                formatMoney(row[column.key] as string | number)
              ) : column.key === "contact_name" || column.key === "name" ? (
                <span className="font-medium">
                  {String(row[column.key] ?? "—")}
                </span>
              ) : (
                String(row[column.key] ?? "—")
              ),
          })),
          {
            label: "Actions",
            render: (row) => (
              <Link
                className="inline-flex min-h-10 items-center text-primary underline"
                href={`/admin/${entity}/${row.id}`}
                aria-label={`Edit ${row.name ?? row.contact_name}`}
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

export async function EntityEditor({
  entity,
  id,
  searchParams,
}: {
  entity: Entity;
  id: string;
  searchParams: Promise<SearchParams>;
}) {
  await requireRole(entity === "customers" ? ["admin", "staff"] : ["admin"]);
  const params = await searchParams;
  const config = entityConfig(entity);
  const admin = createAdminClient();
  let row: EntityRow | null = null;
  if (id !== "new") {
    const parsedId = idSchema.safeParse(id);
    if (!parsedId.success) notFound();
    const { data, error } = await admin
      .from(config.table)
      .select(config.select)
      .eq("id", parsedId.data)
      .maybeSingle();
    if (error) throw new Error("Could not load this record.");
    if (!data) notFound();
    row = data as unknown as EntityRow;
  }
  const initial: Record<string, string | boolean> = { ...config.defaults };
  if (entity === "plans" && !row)
    initial.available_from = new Date().toISOString().slice(0, 10);
  if (row)
    for (const field of config.fields)
      initial[field.name] =
        typeof row[field.name] === "boolean"
          ? (row[field.name] as boolean)
          : String(row[field.name] ?? "");
  const fields = config.fields.map((field) => ({ ...field }));
  let taxLookup: React.ReactNode = null;
  if (entity === "products") {
    const taxPage = parsePage({ page: params.taxPage, pageSize: "100" });
    const taxSearch = safeSearch(single(params.taxSearch));
    let query = admin
      .from("taxes")
      .select("id,name,rate_pct", { count: "exact" })
      .eq("is_active", true)
      .order("id");
    if (taxSearch) query = query.ilike("name", searchPattern(taxSearch));
    const {
      data: taxes,
      count,
      error,
    } = await query.range(taxPage.from, taxPage.to);
    if (error) throw new Error("Could not load tax rates.");
    const options = (taxes ?? []).map((tax) => ({
      value: String(tax.id),
      label: `${tax.name} (${tax.rate_pct}%)`,
    }));
    if (
      row?.tax_id &&
      !options.some((option) => option.value === String(row.tax_id))
    ) {
      const { data: selected, error: selectedError } = await admin
        .from("taxes")
        .select("id,name,rate_pct")
        .eq("id", row.tax_id)
        .maybeSingle();
      if (selectedError) throw new Error("Could not load the selected tax.");
      if (selected)
        options.unshift({
          value: String(selected.id),
          label: `${selected.name} (${selected.rate_pct}%)`,
        });
    }
    fields.find((field) => field.name === "tax_id")!.options = [
      { value: "", label: "No tax" },
      ...options,
    ];
    taxLookup = (
      <details className="mb-6 rounded-md border p-4">
        <summary className="text-sm font-medium">
          Find another tax rate ({count ?? 0} matching)
        </summary>
        <form method="get" className="mt-4 flex flex-wrap items-end gap-3">
          <label className="field" htmlFor="taxSearch">
            Tax name
            <Input
              id="taxSearch"
              name="taxSearch"
              defaultValue={taxSearch}
              maxLength={100}
            />
          </label>
          <label className="field" htmlFor="taxPage">
            Tax results page
            <Input
              id="taxPage"
              name="taxPage"
              type="number"
              min="1"
              max={Math.max(1, Math.ceil((count ?? 0) / 100))}
              defaultValue={taxPage.page}
            />
          </label>
          <Button variant="outline">Load tax options</Button>
        </form>
        <p className="mt-3 text-xs text-muted-foreground">
          100 options per page. Loading options reloads this form; save your
          changes first.
        </p>
      </details>
    );
  }
  const hidden = { entity, ...(row ? { id: String(row.id) } : {}) };
  return (
    <>
      <Breadcrumbs
        items={[
          { href: "/admin", label: "Admin" },
          { href: `/admin/${entity}`, label: config.title },
          { label: row ? String((row as any).name || (row as any).contact_name || `#${(row as any).id}`) : `New ${config.singular}` },
        ]}
      />
      <PageHeader
        title={`${row ? "Edit" : "Add"} ${config.singular}`}
        description={
          entity === "products" && !row
            ? "Save the product first, then add its variants on this page."
            : undefined
        }
      />
      <Notice params={params} />
      <div className="max-w-3xl rounded-[14px] border bg-card p-4 shadow-sm">
        {taxLookup}
        <EntityForm
          key={`${entity}-${id}-${single(params.taxPage)}-${single(params.taxSearch)}`}
          action={entity === "customers" ? saveCustomer : saveCatalogue}
          fields={fields}
          initial={initial}
          hidden={hidden}
          cancelHref={`/admin/${entity}`}
        />
        {row && config.deletable && (
          <div className="mt-10 border-t pt-6">
            <p className="mb-3 text-sm text-muted-foreground">
              Records in use cannot be deleted.
            </p>
            <RecordAction
              action={deleteCatalogue}
              hidden={hidden}
              label={`Delete ${config.singular}`}
              confirm
            />
          </div>
        )}
        {row && entity === "products" && row.is_active && (
          <div className="mt-8 border-t pt-6">
            <RecordAction
              action={archiveProduct}
              hidden={{ id: String(row.id) }}
              label="Archive product"
            />
          </div>
        )}
        {row && entity === "products" && (
          <Variants productId={row.id} params={params} />
        )}
      </div>
    </>
  );
}

async function Variants({
  productId,
  params,
}: {
  productId: number;
  params: SearchParams;
}) {
  await requireRole(["admin"]);
  const pagination = parsePage({ ...params, page: params.variantPage });
  const { data, count, error } = await createAdminClient()
    .from("product_variants")
    .select("id,attribute,value,price_adjustment")
    .eq("product_id", productId)
    .order("id")
    .range(pagination.from, pagination.to);
  if (error) throw new Error("Could not load product variants.");
  const fields = [
    {
      name: "attribute",
      label: "Attribute",
      required: true,
      help: "For example: Brand.",
    },
    {
      name: "value",
      label: "Value",
      required: true,
      help: "For example: Odoo.",
    },
    {
      name: "price_adjustment",
      label: "Price adjustment (₹)",
      type: "number" as const,
      step: "0.01",
      required: true,
    },
  ];
  function href(page: number) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (single(value) && !["message", "variantPage"].includes(key))
        query.set(key, single(value));
    }
    query.set("variantPage", String(page));
    return `?${query}#variants`;
  }
  return (
    <section id="variants" className="mt-12 border-t pt-8">
      <h2 className="text-xl font-semibold">Product variants</h2>
      <p className="mt-2 mb-6 text-sm leading-6 text-muted-foreground">
        Adjust the product price by attribute and value. A positive adjustment
        adds to the sales price.
      </p>
      <div className="mb-8 divide-y rounded-lg border">
        {data?.length ? (
          data.map((variant) => (
            <details key={variant.id} className="p-4">
              <summary className="text-sm">
                <span className="font-medium">
                  {variant.attribute}: {variant.value}
                </span>
                <span className="ml-4 text-muted-foreground">
                  {formatMoney(variant.price_adjustment)} · Edit
                </span>
              </summary>
              <div className="mt-5">
                <EntityForm
                  action={saveVariant}
                  fields={fields}
                  initial={{
                    attribute: variant.attribute,
                    value: variant.value,
                    price_adjustment: String(variant.price_adjustment),
                  }}
                  hidden={{
                    product_id: String(productId),
                    id: String(variant.id),
                  }}
                />
                <div className="mt-4">
                  <RecordAction
                    action={deleteVariant}
                    hidden={{
                      product_id: String(productId),
                      id: String(variant.id),
                    }}
                    label="Remove variant"
                    confirm
                  />
                </div>
              </div>
            </details>
          ))
        ) : (
          <p className="p-5 text-sm text-muted-foreground">
            No variants yet. Add one below.
          </p>
        )}
      </div>
      <nav
        aria-label="Variant pagination"
        className="mb-8 flex flex-wrap items-center gap-4 text-sm"
      >
        <span className="text-muted-foreground">
          {count ?? 0} variants · Page {pagination.page}
        </span>
        {pagination.page > 1 && (
          <Link
            href={href(pagination.page - 1)}
            className="text-primary underline"
          >
            Previous
          </Link>
        )}
        {pagination.page * pagination.pageSize < (count ?? 0) && (
          <Link
            href={href(pagination.page + 1)}
            className="text-primary underline"
          >
            Next
          </Link>
        )}
      </nav>
      <h3 className="mb-5 font-semibold">Add variant</h3>
      <EntityForm
        action={saveVariant}
        fields={fields}
        initial={{ price_adjustment: "0.00" }}
        hidden={{ product_id: String(productId) }}
        submitLabel="Add variant"
      />
    </section>
  );
}
