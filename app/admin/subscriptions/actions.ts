"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  idSchema,
  newSubscriptionSchema,
  productLineSchema,
  subscriptionDatesSchema,
} from "@/lib/validation";
import { addDateDays, today } from "@/lib/dates";
import { fromCents, toCents } from "@/lib/money";
import {
  editableSubscription,
  getPlan,
  getTemplate,
  getSubscriptionLines,
} from "@/lib/subscriptions/data";
import {
  priceLine,
  buildPlanFeeLine,
  lineAmount,
} from "@/lib/subscriptions/pricing";
import { validatePlanAvailability } from "@/lib/subscriptions/calculations";
import { MAX_PRODUCT_LINES } from "@/lib/subscriptions/types";
import { transition, transitionActions } from "@/lib/subscriptions/transitions";
import { actionError, formErrors } from "@/lib/form-errors";
import type { ActionState } from "@/lib/action-state";

export async function templatePreview(templateId: number) {
  await requireRole(["admin", "staff"]);
  try {
    const template = await getTemplate(idSchema.parse(templateId));
    const plan = await getPlan(template.plan_id);
    const lines = await Promise.all(
      template.lines.map(async (line) => ({
        ...line,
        ...(await priceLine(line.product_id, line.variant_id)),
      })),
    );
    return {
      template: { ...template, lines },
      plan,
      quoteValidUntil: addDateDays(today(), template.validity_days),
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not load this template.",
    };
  }
}
export async function createSubscription(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await requireRole(["admin", "staff"]);
  const parsed = newSubscriptionSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return formErrors(parsed.error.issues);
  let createdId: number;
  try {
    const input = parsed.data;
    const admin = createAdminClient();
    const plan = await getPlan(input.plan_id);
    validatePlanAvailability(plan, input.start_date);
    const template = input.template_id
      ? await getTemplate(input.template_id)
      : null;
    if (template && template.plan_id !== plan.id)
      throw new Error(
        "The chosen plan does not match the quotation template. Reload the template.",
      );
    if (template && !template.lines.length)
      throw new Error(
        "This template has no product lines. Ask an administrator to complete it first.",
      );
    const { data: customer, error: customerError } = await admin
      .from("customers")
      .select("id")
      .eq("id", input.customer_id)
      .maybeSingle();
    if (customerError || !customer)
      throw new Error("Choose an existing customer.");
    const { data: terms, error: termsError } = await admin
      .from("payment_terms")
      .select("id")
      .eq("id", input.payment_terms_id)
      .maybeSingle();
    if (termsError || !terms) throw new Error("Choose existing payment terms.");
    const productLines = await Promise.all(
      (template?.lines ?? []).map(async (line) => {
        if (line.quantity < plan.min_quantity)
          throw new Error(
            `Every product line needs at least ${plan.min_quantity} units.`,
          );
        const pricing = await priceLine(line.product_id, line.variant_id);
        return {
          product_id: line.product_id,
          variant_id: line.variant_id,
          quantity: line.quantity,
          ...pricing,
          amount: fromCents(
            lineAmount(line.quantity, toCents(pricing.unit_price)),
          ),
          is_plan_fee: false,
        };
      }),
    );
    const { data: subscription, error } = await admin
      .from("subscriptions")
      .insert({
        ...input,
        created_by: actor.id,
        quote_valid_until: template
          ? addDateDays(today(), template.validity_days)
          : null,
      })
      .select("id")
      .single();
    if (error)
      throw new Error(
        "Could not create the subscription. Check the selected records and dates.",
      );
    const { error: lineError } = await admin
      .from("subscription_lines")
      .insert(
        [buildPlanFeeLine(plan), ...productLines].map((line) => ({
          ...line,
          subscription_id: subscription.id,
        })),
      );
    if (lineError) {
      const { error: cleanupError } = await admin
        .from("subscriptions")
        .delete()
        .eq("id", subscription.id)
        .eq("created_by", actor.id)
        .eq("status", "draft");
      if (cleanupError)
        throw new Error(
          `Subscription ${subscription.id} was created, but lines could not be saved. Contact an administrator before continuing.`,
        );
      throw new Error(
        "Could not save subscription lines. The incomplete subscription was removed; please try again.",
      );
    }
    createdId = subscription.id;
  } catch (error) {
    return actionError(error);
  }
  revalidatePath("/admin/subscriptions");
  redirect(`/admin/subscriptions/${createdId}?message=saved`);
}
export async function saveSubscriptionDates(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireRole(["admin", "staff"]);
  const parsed = subscriptionDatesSchema.safeParse(Object.fromEntries(form));
  const id = idSchema.safeParse(form.get("subscription_id"));
  if (!parsed.success) return formErrors(parsed.error.issues);
  if (!id.success) return { error: "Invalid subscription id." };
  try {
    const { subscription, plan } = await editableSubscription(id.data);
    validatePlanAvailability(plan, parsed.data.start_date);
    const { error, data } = await createAdminClient()
      .from("subscriptions")
      .update(parsed.data)
      .eq("id", id.data)
      .eq("status", subscription.status)
      .select("id")
      .maybeSingle();
    if (error || !data)
      throw new Error(
        "The subscription changed or the selected payment terms are invalid. Reload and try again.",
      );
    revalidatePath(`/admin/subscriptions/${id.data}`);
    revalidatePath("/admin/subscriptions");
    return { message: "Subscription dates and payment terms saved." };
  } catch (error) {
    return actionError(error);
  }
}
export async function saveSubscriptionLine(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireRole(["admin", "staff"]);
  const parsed = productLineSchema.safeParse(Object.fromEntries(form));
  const parent = idSchema.safeParse(form.get("subscription_id"));
  const id = form.get("id") ? idSchema.safeParse(form.get("id")) : null;
  if (!parsed.success) return formErrors(parsed.error.issues);
  if (!parent.success || (id && !id.success))
    return { error: "Invalid subscription or line id." };
  try {
    const { plan } = await editableSubscription(parent.data);
    if (parsed.data.quantity < plan.min_quantity)
      throw new Error(
        `This plan requires at least ${plan.min_quantity} units per product line.`,
      );
    if (!id) {
      const lines = await getSubscriptionLines(parent.data);
      if (lines.filter((line) => !line.is_plan_fee).length >= MAX_PRODUCT_LINES)
        throw new Error("A subscription supports at most 99 product lines.");
    }
    const pricing = await priceLine(
      parsed.data.product_id,
      parsed.data.variant_id,
    );
    const payload = {
      ...parsed.data,
      ...pricing,
      amount: fromCents(
        lineAmount(parsed.data.quantity, toCents(pricing.unit_price)),
      ),
    };
    const admin = createAdminClient();
    const query = id?.success
      ? admin
          .from("subscription_lines")
          .update(payload)
          .eq("id", id.data)
          .eq("subscription_id", parent.data)
          .eq("is_plan_fee", false)
      : admin
          .from("subscription_lines")
          .insert({
            ...payload,
            subscription_id: parent.data,
            is_plan_fee: false,
          });
    const { error, data } = await query.select("id").single();
    if (error || !data)
      throw new Error(
        "Could not save this product line. The plan-fee line cannot be edited.",
      );
    revalidatePath(`/admin/subscriptions/${parent.data}`);
    revalidatePath("/admin/subscriptions");
    return { message: "Product line saved with current catalogue pricing." };
  } catch (error) {
    return actionError(error);
  }
}
export async function removeSubscriptionLine(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireRole(["admin", "staff"]);
  const id = idSchema.safeParse(form.get("id"));
  const parent = idSchema.safeParse(form.get("subscription_id"));
  if (!id.success || !parent.success)
    return { error: "Invalid subscription line id." };
  try {
    await editableSubscription(parent.data);
    const { data, error } = await createAdminClient()
      .from("subscription_lines")
      .delete()
      .eq("id", id.data)
      .eq("subscription_id", parent.data)
      .eq("is_plan_fee", false)
      .select("id")
      .single();
    if (error || !data)
      throw new Error(
        "Could not remove this line. The plan-fee line is locked.",
      );
    revalidatePath(`/admin/subscriptions/${parent.data}`);
    revalidatePath("/admin/subscriptions");
    return { message: "Product line removed." };
  } catch (error) {
    return actionError(error);
  }
}
export async function transitionSubscription(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await requireRole(["admin", "staff"]);
  const parsed = z
    .object({ subscription_id: idSchema, action: z.enum(transitionActions) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Invalid subscription action." };
  try {
    const result = await transition(
      parsed.data.subscription_id,
      parsed.data.action,
      actor,
    );
    revalidatePath(`/admin/subscriptions/${result.id}`);
    revalidatePath("/admin/subscriptions");
    return { message: `Subscription is now ${result.status}.` };
  } catch (error) {
    return actionError(error);
  }
}
