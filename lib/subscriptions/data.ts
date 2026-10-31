import "server-only";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { idSchema } from "@/lib/validation";
import type { Plan, Subscription, SubscriptionLine } from "./types";

export async function getPlan(id: number): Promise<Plan> {
  await requireRole(["admin", "staff"]);
  const { data, error } = await createAdminClient()
    .from("plans")
    .select(
      "id,name,price,billing_period,min_quantity,available_from,available_to,is_active,auto_close,allow_pause,allow_early_close,allow_renewal",
    )
    .eq("id", idSchema.parse(id))
    .single();
  if (error) throw new Error("Plan not found.");
  return data as Plan;
}
export async function getSubscription(id: number): Promise<Subscription> {
  await requireRole(["admin", "staff"]);
  const { data, error } = await createAdminClient()
    .from("subscriptions")
    .select(
      "id,number,customer_id,plan_id,template_id,payment_terms_id,status,start_date,expiry_date,quote_valid_until,next_billing_date,periods_billed,closed_at",
    )
    .eq("id", idSchema.parse(id))
    .single();
  if (error) throw new Error("Subscription not found.");
  return data as Subscription;
}
export async function getSubscriptionLines(
  id: number,
): Promise<SubscriptionLine[]> {
  await requireRole(["admin", "staff"]);
  const { data, error, count } = await createAdminClient()
    .from("subscription_lines")
    .select(
      "id,subscription_id,product_id,variant_id,description,quantity,unit_price,tax_pct,amount,is_plan_fee",
      { count: "exact" },
    )
    .eq("subscription_id", idSchema.parse(id))
    .order("is_plan_fee", { ascending: false })
    .order("id")
    .limit(100);
  if (error) throw new Error("Could not load subscription lines.");
  if ((count ?? 0) > 100)
    throw new Error(
      "This subscription exceeds the demo limit of 100 total lines.",
    );
  return data as SubscriptionLine[];
}
export async function editableSubscription(id: number) {
  const subscription = await getSubscription(id);
  if (subscription.status !== "draft" && subscription.status !== "quotation")
    throw new Error("Lines are read-only once a subscription is confirmed.");
  return { subscription, plan: await getPlan(subscription.plan_id) };
}
export type TemplateLine = {
  id: number;
  product_id: number;
  variant_id: number | null;
  quantity: number;
  product: { name: string } | null;
  variant: { attribute: string; value: string } | null;
};
export async function getTemplate(
  id: number,
): Promise<{
  id: number;
  name: string;
  plan_id: number;
  validity_days: number;
  lines: TemplateLine[];
}> {
  await requireRole(["admin", "staff"]);
  const admin = createAdminClient();
  const { data: template, error } = await admin
    .from("quotation_templates")
    .select("id,name,plan_id,validity_days")
    .eq("id", idSchema.parse(id))
    .single();
  if (error) throw new Error("Quotation template not found.");
  const {
    data: lines,
    count,
    error: lineError,
  } = await admin
    .from("quotation_template_lines")
    .select(
      "id,product_id,variant_id,quantity,product:products(name),variant:product_variants(attribute,value)",
      { count: "exact" },
    )
    .eq("template_id", id)
    .order("id")
    .limit(100);
  if (lineError) throw new Error("Could not load template lines.");
  if ((count ?? 0) > 99)
    throw new Error("Templates support up to 99 product lines in this demo.");
  return { ...template, lines: (lines ?? []) as unknown as TemplateLine[] };
}
