"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { discountSchema, idSchema } from "@/lib/validation";
import { formErrors } from "@/lib/form-errors";
import type { ActionState } from "@/lib/action-state";
export async function saveDiscount(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await requireRole(["admin"]);
  const parsed = discountSchema.safeParse({
    ...Object.fromEntries(form),
    is_active: form.get("is_active") === "on",
  });
  if (!parsed.success) return formErrors(parsed.error.issues);
  const admin = createAdminClient();
  const rawId = form.get("id");
  const id = rawId ? idSchema.safeParse(rawId) : null;
  if (id && !id.success) return { error: "Invalid discount id." };
  if (parsed.data.product_id) {
    const { data, error } = await admin
      .from("products")
      .select("id")
      .eq("id", parsed.data.product_id)
      .maybeSingle();
    if (error || !data) return { error: "Choose an existing product." };
  }
  if (id?.success) {
    const { data, error } = await admin
      .from("discounts")
      .select("used_count")
      .eq("id", id.data)
      .single();
    if (error) return { error: "Discount not found." };
    if (
      parsed.data.usage_limit !== null &&
      parsed.data.usage_limit < data.used_count
    )
      return {
        error: `Usage limit cannot be below the ${data.used_count} existing redemptions.`,
      };
  }
  const payload = parsed.data;
  const query = id?.success
    ? admin.from("discounts").update(payload).eq("id", id.data)
    : admin.from("discounts").insert({ ...payload, created_by: actor.id });
  const { error, data } = await query.select("id").single();
  if (error || !data)
    return {
      error:
        "Could not save this discount. Check the usage limit and try again.",
    };
  revalidatePath("/admin/discounts");
  redirect("/admin/discounts?message=saved");
}
