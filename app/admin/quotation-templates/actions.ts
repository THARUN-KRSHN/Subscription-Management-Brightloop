"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  idSchema,
  quotationTemplateSchema,
  productLineSchema,
} from "@/lib/validation";
import { getPlan, getTemplate } from "@/lib/subscriptions/data";
import { priceLine } from "@/lib/subscriptions/pricing";
import { MAX_PRODUCT_LINES } from "@/lib/subscriptions/types";
import { actionError, formErrors } from "@/lib/form-errors";
import type { ActionState } from "@/lib/action-state";

export async function saveQuotationTemplate(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await requireRole(["admin"]);
  const parsed = quotationTemplateSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return formErrors(parsed.error.issues);
  const id = form.get("id") ? idSchema.safeParse(form.get("id")) : null;
  if (id && !id.success) return { error: "Invalid template id." };
  try {
    const plan = await getPlan(parsed.data.plan_id);
    if (id?.success) {
      const template = await getTemplate(id.data);
      if (template.lines.some((line) => line.quantity < plan.min_quantity))
        throw new Error(
          `Existing lines need at least ${plan.min_quantity} units for this plan. Update the lines before switching plans.`,
        );
    }
  } catch (error) {
    return actionError(error);
  }
  const admin = createAdminClient();
  const query = id?.success
    ? admin.from("quotation_templates").update(parsed.data).eq("id", id.data)
    : admin
        .from("quotation_templates")
        .insert({ ...parsed.data, created_by: actor.id });
  const { data, error } = await query.select("id").single();
  if (error) return { error: "Could not save the quotation template." };
  revalidatePath("/admin/quotation-templates");
  redirect(`/admin/quotation-templates/${data.id}?message=saved`);
}
export async function saveTemplateLine(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireRole(["admin"]);
  const parsed = productLineSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return formErrors(parsed.error.issues);
  const parent = idSchema.safeParse(form.get("template_id"));
  const id = form.get("id") ? idSchema.safeParse(form.get("id")) : null;
  if (!parent.success || (id && !id.success))
    return { error: "Invalid template or line id." };
  try {
    const template = await getTemplate(parent.data);
    const plan = await getPlan(template.plan_id);
    if (parsed.data.quantity < plan.min_quantity)
      throw new Error(
        `This plan requires at least ${plan.min_quantity} units per product line.`,
      );
    if (!id && template.lines.length >= MAX_PRODUCT_LINES)
      throw new Error("A template supports at most 99 product lines.");
    await priceLine(parsed.data.product_id, parsed.data.variant_id);
    const admin = createAdminClient();
    const query = id?.success
      ? admin
          .from("quotation_template_lines")
          .update(parsed.data)
          .eq("id", id.data)
          .eq("template_id", parent.data)
      : admin
          .from("quotation_template_lines")
          .insert({ ...parsed.data, template_id: parent.data });
    const { data, error } = await query.select("id").single();
    if (error || !data) throw new Error("Could not save this template line.");
    revalidatePath(`/admin/quotation-templates/${parent.data}`);
    return { message: "Template line saved." };
  } catch (error) {
    return actionError(error);
  }
}
export async function removeTemplateLine(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireRole(["admin"]);
  const id = idSchema.safeParse(form.get("id"));
  const parent = idSchema.safeParse(form.get("template_id"));
  if (!id.success || !parent.success)
    return { error: "Invalid template line id." };
  const { data, error } = await createAdminClient()
    .from("quotation_template_lines")
    .delete()
    .eq("id", id.data)
    .eq("template_id", parent.data)
    .select("id")
    .single();
  if (error || !data) return { error: "Could not remove this template line." };
  revalidatePath(`/admin/quotation-templates/${parent.data}`);
  return { message: "Template line removed." };
}
