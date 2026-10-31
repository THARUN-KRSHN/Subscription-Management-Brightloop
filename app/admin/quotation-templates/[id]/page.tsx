import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { idSchema } from "@/lib/validation";
import { getTemplate, getPlan } from "@/lib/subscriptions/data";
import { parsePage, pagedResult, type SearchParams } from "@/lib/pagination";
import { PageHeader } from "@/components/PageHeader";
import { Phase2Form } from "@/components/Phase2Form";
import { DataTable } from "@/components/DataTable";
import { RecordAction } from "@/components/RecordAction";
import { Notice } from "@/components/EntityPages";
import { buttonVariants } from "@/components/ui/button";
import {
  saveQuotationTemplate,
  saveTemplateLine,
  removeTemplateLine,
} from "../actions";
export default async function TemplateEditor({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const actor = await requireRole(["admin", "staff"]);
  const { id } = await params;
  if (id === "new") await requireRole(["admin"]);
  const query = await searchParams;
  const pagination = parsePage(query);
  const parsed = id === "new" ? null : idSchema.safeParse(id);
  if (parsed && !parsed.success) notFound();
  const template = parsed?.success ? await getTemplate(parsed.data) : null;
  const plan = template ? await getPlan(template.plan_id) : null;
  const canEdit = actor.role === "admin";
  const lineFields = [
    { name: "product_id", label: "Product", required: true },
    { name: "variant_id", label: "Variant" },
    {
      name: "quantity",
      label: "Quantity",
      type: "number" as const,
      min: String(plan?.min_quantity ?? 1),
      step: "1",
      required: true,
    },
  ];
  return (
    <>
      <Link
        href="/admin/quotation-templates"
        className="mb-6 inline-flex min-h-10 items-center text-sm text-primary underline"
      >
        Back to quotation templates
      </Link>
      <PageHeader
        title={template ? template.name : "Add quotation template"}
        description={
          template
            ? `${plan?.name} · Quotes valid for ${template.validity_days} days`
            : "Save the template, then add its product lines below."
        }
        action={
          template ? (
            <Link
              className={buttonVariants({ variant: "outline" })}
              href={`/admin/subscriptions/new?template=${template.id}`}
            >
              Use template
            </Link>
          ) : undefined
        }
      />
      <Notice params={query} />
      <div className="max-w-3xl">
        {canEdit && (
          <Phase2Form
            action={saveQuotationTemplate}
            fields={[
              { name: "name", label: "Name", required: true },
              { name: "plan_id", label: "Plan", required: true },
              {
                name: "validity_days",
                label: "Validity (days)",
                type: "number",
                min: "1",
                max: "36500",
                step: "1",
                required: true,
              },
            ]}
            initial={{
              name: template?.name ?? "",
              plan_id: String(template?.plan_id ?? ""),
              validity_days: String(template?.validity_days ?? 30),
            }}
            labels={{ plan_id: plan?.name ?? "" }}
            hidden={template ? { id: String(template.id) } : {}}
            lookups={{ plan_id: "plans" }}
          />
        )}
      </div>
      {template && (
        <section className="mt-10 border-t pt-8">
          <h2 className="mb-5 text-xl font-semibold">Product lines</h2>
          <DataTable
            {...pagedResult(
              template.lines.slice(pagination.from, pagination.to + 1),
              template.lines.length,
              pagination.page,
              pagination.pageSize,
            )}
            pathname={`/admin/quotation-templates/${id}`}
            params={query}
            columns={[
              {
                label: "Product",
                render: (line) =>
                  line.product?.name ?? `Product #${line.product_id}`,
              },
              {
                label: "Variant",
                render: (line) =>
                  line.variant
                    ? `${line.variant.attribute}: ${line.variant.value}`
                    : "—",
              },
              { label: "Quantity", render: (line) => line.quantity },
              ...(canEdit
                ? [
                    {
                      label: "Edit",
                      render: (line: (typeof template.lines)[number]) => (
                        <details>
                          <summary className="text-primary">Edit line</summary>
                          <div className="mt-4 min-w-64">
                            <Phase2Form
                              action={saveTemplateLine}
                              fields={lineFields}
                              initial={{
                                product_id: String(line.product_id),
                                variant_id: String(line.variant_id ?? ""),
                                quantity: String(line.quantity),
                              }}
                              labels={{
                                product_id: line.product?.name ?? "",
                                variant_id: line.variant
                                  ? `${line.variant.attribute}: ${line.variant.value}`
                                  : "",
                              }}
                              hidden={{
                                template_id: String(template.id),
                                id: String(line.id),
                              }}
                              lookups={{
                                product_id: "products",
                                variant_id: "variants",
                              }}
                            />
                            <div className="mt-4">
                              <RecordAction
                                action={removeTemplateLine}
                                hidden={{
                                  template_id: String(template.id),
                                  id: String(line.id),
                                }}
                                label="Remove line"
                                confirm
                              />
                            </div>
                          </div>
                        </details>
                      ),
                    },
                  ]
                : []),
            ]}
          />
          {canEdit && (
            <div className="mt-8 max-w-3xl">
              <h3 className="mb-5 font-semibold">Add product line</h3>
              <Phase2Form
                action={saveTemplateLine}
                fields={lineFields}
                initial={{ quantity: String(plan?.min_quantity ?? 1) }}
                hidden={{ template_id: String(template.id) }}
                lookups={{ product_id: "products", variant_id: "variants" }}
                submitLabel="Add product line"
              />
            </div>
          )}
        </section>
      )}
    </>
  );
}
