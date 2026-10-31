import "server-only";
import { z } from "zod";
import { requireRole, type SessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { idSchema } from "@/lib/validation";
import { addDateDays, today } from "@/lib/dates";
import type { SubscriptionStatus } from "./types";

export const transitionActions = [
  "sendQuotation",
  "confirm",
  "activate",
  "pause",
  "resume",
  "close",
  "cancel",
] as const;
export type TransitionAction = (typeof transitionActions)[number];
export async function transition(
  subscriptionId: number,
  action: TransitionAction,
  actor: SessionUser,
) {
  const authenticated = await requireRole(["admin", "staff", "customer"]);
  if (authenticated.id !== actor.id || authenticated.role !== actor.role)
    throw new Error("Your session changed. Reload and try again.");
  idSchema.parse(subscriptionId);
  z.enum(transitionActions).parse(action);
  const admin = createAdminClient();
  const { data: subscription, error } = await admin
    .from("subscriptions")
    .select(
      "id,status,start_date,expiry_date,template_id,quote_valid_until,plan_id",
    )
    .eq("id", subscriptionId)
    .single();
  if (error) throw new Error("Subscription not found.");
  const { data: plan, error: planError } = await admin
    .from("plans")
    .select("allow_pause,allow_early_close,min_quantity")
    .eq("id", subscription.plan_id)
    .single();
  if (planError) throw new Error("Could not load the subscription plan.");
  const status = subscription.status as SubscriptionStatus;
  const patch: Record<string, string | number | null> = {};
  const invalid = () => {
    throw new Error(
      `Cannot ${action} a ${status} subscription. Follow Draft → Quotation → Confirmed → Active, then pause or close.`,
    );
  };
  switch (action) {
    case "sendQuotation": {
      if (status !== "draft") invalid();
      const { data: lines, error: lineError } = await admin
        .from("subscription_lines")
        .select("quantity,is_plan_fee")
        .eq("subscription_id", subscriptionId)
        .order("id")
        .limit(100);
      if (lineError) throw new Error("Could not verify subscription lines.");
      const products = lines?.filter((line) => !line.is_plan_fee) ?? [];
      if (!products.length)
        throw new Error(
          "Add at least one product line before sending a quotation.",
        );
      if (products.some((line) => line.quantity < plan.min_quantity))
        throw new Error(
          `Every product line needs at least ${plan.min_quantity} units.`,
        );
      let validity = 30;
      if (subscription.template_id) {
        const { data: template, error: templateError } = await admin
          .from("quotation_templates")
          .select("validity_days")
          .eq("id", subscription.template_id)
          .single();
        if (templateError)
          throw new Error("Could not load quotation validity.");
        validity = template.validity_days;
      }
      patch.status = "quotation";
      patch.quote_valid_until = addDateDays(today(), validity);
      break;
    }
    case "confirm":
      if (status !== "quotation") invalid();
      if (
        !subscription.quote_valid_until ||
        subscription.quote_valid_until < today()
      )
        throw new Error("This quotation has expired and cannot be confirmed.");
      patch.status = "confirmed";
      break;
    case "activate":
      if (status !== "confirmed") invalid();
      patch.status = "active";
      patch.next_billing_date = subscription.start_date;
      patch.periods_billed = 0;
      break;
    case "pause":
    case "resume":
      if (status !== (action === "pause" ? "active" : "paused")) invalid();
      if (!plan.allow_pause)
        throw new Error(
          "This plan does not allow pausing or resuming subscriptions.",
        );
      patch.status = action === "pause" ? "paused" : "active";
      break;
    case "close":
      if (status !== "active" && status !== "paused") invalid();
      // R4 explicitly grants admin/staff an override, including when allow_early_close=false.
      if (
        subscription.expiry_date >= today() &&
        !plan.allow_early_close &&
        !["admin", "staff"].includes(authenticated.role)
      )
        throw new Error("This plan does not allow early closure.");
      patch.status = "closed";
      patch.closed_at = new Date().toISOString();
      break;
    case "cancel":
      if (status !== "draft" && status !== "quotation") invalid();
      patch.status = "closed";
      patch.closed_at = new Date().toISOString();
      break;
  }
  const { data: updated, error: updateError } = await admin
    .from("subscriptions")
    .update(patch)
    .eq("id", subscriptionId)
    .eq("status", status)
    .select("id,status")
    .maybeSingle();
  if (updateError)
    throw new Error("Could not update subscription status. Please try again.");
  if (!updated)
    throw new Error(
      "This subscription changed in another session. Reload before trying again.",
    );
  return updated as { id: number; status: SubscriptionStatus };
}
