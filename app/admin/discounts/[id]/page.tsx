import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { idSchema } from "@/lib/validation";
import { today } from "@/lib/dates";
import type { Field } from "@/lib/catalogue";
import { saveDiscount } from "../actions";
import { PageHeader } from "@/components/PageHeader";
import { Phase2Form } from "@/components/Phase2Form";
const fields: Field[] = [
  { name: "name", label: "Name", required: true },
  {
    name: "kind",
    label: "Kind",
    type: "select",
    options: [
      { value: "percentage", label: "Percentage" },
      { value: "fixed", label: "Fixed amount" },
    ],
  },
  {
    name: "value",
    label: "Value (% or ₹)",
    type: "number",
    min: "0.01",
    step: "0.01",
    required: true,
  },
  {
    name: "scope",
    label: "Scope",
    type: "select",
    options: [
      { value: "subscription", label: "Whole subscription" },
      { value: "product", label: "One product" },
    ],
  },
  { name: "product_id", label: "Product", required: true },
  {
    name: "min_purchase",
    label: "Minimum purchase (₹)",
    type: "number",
    min: "0",
    step: "0.01",
  },
  {
    name: "min_quantity",
    label: "Minimum product quantity",
    type: "number",
    min: "1",
    step: "1",
  },
  { name: "starts_on", label: "Starts on", type: "date", required: true },
  { name: "ends_on", label: "Ends on", type: "date" },
  {
    name: "usage_limit",
    label: "Usage limit",
    type: "number",
    min: "1",
    step: "1",
    help: "Leave blank for unlimited uses.",
  },
  { name: "is_active", label: "Active", type: "checkbox" },
];
export default async function DiscountEditor({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["admin"]);
  const { id } = await params;
  let initial: Record<string, string | boolean> = {
    kind: "percentage",
    scope: "subscription",
    starts_on: today(),
    is_active: true,
    product_id: "",
  };
  let usedCount = 0;
  let productLabel = "";
  if (id !== "new") {
    const parsed = idSchema.safeParse(id);
    if (!parsed.success) notFound();
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("discounts")
      .select(
        "id,name,kind,value,scope,product_id,min_purchase,min_quantity,starts_on,ends_on,usage_limit,is_active,used_count",
      )
      .eq("id", parsed.data)
      .maybeSingle();
    if (error) throw new Error("Could not load this discount.");
    if (!data) notFound();
    const values: Record<string, string | number | boolean | null> = data;
    initial = Object.fromEntries(
      fields.map((field) => [
        field.name,
          typeof values[field.name] === "boolean"
            ? Boolean(values[field.name])
          : String(values[field.name] ?? ""),
      ]),
    );
    usedCount = data.used_count;
    if (data.product_id) {
      const { data: product } = await admin
        .from("products")
        .select("name")
        .eq("id", data.product_id)
        .single();
      productLabel = product?.name ?? "";
    }
  }
  return (
    <>
      <Link
        className="mb-6 inline-flex min-h-10 items-center text-sm text-primary underline"
        href="/admin/discounts"
      >
        Back to discounts
      </Link>
      <PageHeader
        title={id === "new" ? "Add discount" : "Edit discount"}
        description="One best eligible discount will be selected per invoice in Phase 3."
      />
      <div className="max-w-3xl rounded-[14px] border bg-card p-4 shadow-sm">
        <p className="mb-6 text-sm text-muted-foreground">
          Used count (read-only):{" "}
          <strong className="text-foreground">{usedCount}</strong>
        </p>
        <Phase2Form
          action={saveDiscount}
          fields={fields}
          initial={initial}
          hidden={id === "new" ? {} : { id }}
          lookups={{ product_id: "products" }}
          labels={{ product_id: productLabel }}
          productScopeOnly
        />
      </div>
    </>
  );
}
