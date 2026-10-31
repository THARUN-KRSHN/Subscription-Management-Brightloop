"use server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { today } from "@/lib/dates";
export type LookupKind =
  | "customers"
  | "plans"
  | "products"
  | "variants"
  | "payment_terms"
  | "templates";
export type LookupOption = { value: string; label: string };
const schema = z.object({
  kind: z.enum([
    "customers",
    "plans",
    "products",
    "variants",
    "payment_terms",
    "templates",
  ]),
  q: z.string().max(100).default(""),
  page: z.number().int().min(1).max(1000000).default(1),
  parentId: z.number().int().positive().nullable().optional(),
  availableOnly: z.boolean().optional(),
});
export async function lookupOptions(
  input: z.input<typeof schema>,
): Promise<{ options: LookupOption[]; total: number; error?: string }> {
  await requireRole(["admin", "staff"]);
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return { options: [], total: 0, error: "Invalid search." };
  const { kind, q, page, parentId, availableOnly } = parsed.data;
  if (kind === "variants" && !parentId) return { options: [], total: 0 };
  const table =
    kind === "variants"
      ? "product_variants"
      : kind === "templates"
        ? "quotation_templates"
        : kind;
  const columns =
    kind === "customers"
      ? "id,contact_name,company_name"
      : kind === "variants"
        ? "id,attribute,value"
        : "id,name";
  let query = createAdminClient()
    .from(table)
    .select(columns, { count: "exact" });
  if (kind === "products") query = query.eq("is_active", true);
  if (kind === "plans" && availableOnly)
    query = query
      .eq("is_active", true)
      .lte("available_from", today())
      .or(`available_to.is.null,available_to.gte.${today()}`);
  if (kind === "variants") query = query.eq("product_id", parentId!);
  if (q.trim()) {
    const pattern = `%${q.trim().replace(/[\\%_]/g, (value) => `\\${value}`)}%`;
    query = query.ilike(
      kind === "customers"
        ? "contact_name"
        : kind === "variants"
          ? "value"
          : "name",
      pattern,
    );
  }
  const { data, count, error } = await query
    .order("id", { ascending: false })
    .range((page - 1) * 20, page * 20 - 1);
  if (error)
    return {
      options: [],
      total: 0,
      error: "Could not load options. Try again.",
    };
  const rows = data as unknown as Record<string, string | number | null>[];
  return {
    options: rows.map((row) => ({
      value: String(row.id),
      label:
        kind === "customers"
          ? `${row.contact_name}${row.company_name ? ` · ${row.company_name}` : ""}`
          : kind === "variants"
            ? `${row.attribute}: ${row.value}`
            : String(row.name),
    })),
    total: count ?? 0,
  };
}
