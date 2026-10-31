import "server-only";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { idSchema } from "@/lib/validation";
import { fromCents, toCents } from "@/lib/money";
import type { Plan } from "./types";
export { lineAmount } from "./calculations";

export async function priceLine(productId: number, variantId?: number | null) {
  await requireRole(["admin", "staff"]);
  idSchema.parse(productId);
  if (variantId != null) idSchema.parse(variantId);
  const admin = createAdminClient();
  const { data: product, error } = await admin
    .from("products")
    .select("id,name,sales_price,tax_id,is_active")
    .eq("id", productId)
    .maybeSingle();
  if (error || !product) throw new Error("Product not found.");
  if (!product.is_active)
    throw new Error("This product is archived. Choose an active product.");
  let cents = toCents(product.sales_price);
  let description = product.name as string;
  if (variantId != null) {
    const { data: variant, error: variantError } = await admin
      .from("product_variants")
      .select("attribute,value,price_adjustment")
      .eq("id", variantId)
      .eq("product_id", productId)
      .maybeSingle();
    if (variantError || !variant)
      throw new Error("The selected variant does not belong to this product.");
    cents += toCents(variant.price_adjustment);
    description += ` (${variant.attribute}: ${variant.value})`;
  }
  if (cents < 0 || cents > 999999999999)
    throw new Error(
      "Product plus variant must have a valid non-negative price.",
    );
  let taxPct: string | number = 0;
  if (product.tax_id) {
    const { data: tax, error: taxError } = await admin
      .from("taxes")
      .select("rate_pct")
      .eq("id", product.tax_id)
      .single();
    if (taxError) throw new Error("Could not load the product tax rate.");
    taxPct = tax.rate_pct;
  }
  return { unit_price: fromCents(cents), tax_pct: taxPct, description };
}
export function buildPlanFeeLine(plan: Pick<Plan, "name" | "price">) {
  const price = fromCents(toCents(plan.price));
  return {
    product_id: null,
    variant_id: null,
    description: `Plan fee: ${plan.name}`,
    quantity: 1,
    unit_price: price,
    tax_pct: 0,
    amount: price,
    is_plan_fee: true,
  };
}
