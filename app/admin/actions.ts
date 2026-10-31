"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { catalogue, entityConfig, type Entity } from "@/lib/catalogue";
import { idSchema, signupSchema, variantSchema } from "@/lib/validation";
import { provisionUser } from "@/lib/provision-user";
import type { ActionState } from "@/lib/action-state";

function validationError(
  issues: { path: PropertyKey[]; message: string }[],
): ActionState {
  return {
    error: "Check the highlighted fields and try again.",
    fieldErrors: Object.fromEntries(
      issues.map((issue) => [String(issue.path[0]), issue.message]),
    ),
  };
}
function dbError(code: string): ActionState {
  return {
    error:
      code === "23505"
        ? "This record already exists. Use a different name or value."
        : code === "23503"
          ? "This record is in use and cannot be deleted. Archive it where available."
          : "Couldn’t save your changes. Please try again.",
  };
}
async function save(entity: Entity, form: FormData): Promise<ActionState> {
  const config = entityConfig(entity);
  const raw: Record<string, unknown> = {};
  for (const field of config.fields)
    raw[field.name] =
      field.type === "checkbox"
        ? form.get(field.name) === "on"
        : String(form.get(field.name) ?? "");
  const parsed = config.schema.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error.issues);
  const idValue = form.get("id");
  const parsedId = idValue ? idSchema.safeParse(idValue) : null;
  if (parsedId && !parsedId.success) return { error: "Invalid record id." };
  const admin = createAdminClient();
  const payload = parsed.data as Record<string, unknown>;
  const query = parsedId?.success
    ? admin.from(config.table).update(payload).eq("id", parsedId.data)
    : admin.from(config.table).insert(payload);
  const { data, error } = await query.select("id").single();
  if (error || !data) return dbError(error?.code ?? "");
  revalidatePath(`/admin/${entity}`);
  redirect(
    entity === "products" && !parsedId
      ? `/admin/products/${data.id}?message=saved`
      : `/admin/${entity}?message=saved`,
  );
}
export async function saveCustomer(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireRole(["admin", "staff"]);
  return save("customers", form);
}
export async function saveCatalogue(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireRole(["admin"]);
  const entity = String(form.get("entity"));
  if (!Object.hasOwn(catalogue, entity) || entity === "customers")
    return { error: "Invalid catalogue type." };
  return save(entity as Entity, form);
}
export async function deleteCatalogue(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireRole(["admin"]);
  const entity = String(form.get("entity"));
  if (entity !== "taxes" && entity !== "payment-terms")
    return { error: "This record cannot be deleted." };
  const id = idSchema.safeParse(form.get("id"));
  if (!id.success) return { error: "Invalid record id." };
  const { data, error } = await createAdminClient()
    .from(entityConfig(entity).table)
    .delete()
    .eq("id", id.data)
    .select("id")
    .single();
  if (error || !data) return dbError(error?.code ?? "");
  revalidatePath(`/admin/${entity}`);
  redirect(`/admin/${entity}?message=deleted`);
}
export async function archiveProduct(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireRole(["admin"]);
  const id = idSchema.safeParse(form.get("id"));
  if (!id.success) return { error: "Invalid product id." };
  const { error, data } = await createAdminClient()
    .from("products")
    .update({ is_active: false })
    .eq("id", id.data)
    .select("id")
    .single();
  if (error || !data) return dbError(error?.code ?? "");
  revalidatePath("/admin/products");
  redirect("/admin/products?message=archived");
}
export async function saveVariant(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireRole(["admin"]);
  const parsed = variantSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return validationError(parsed.error.issues);
  const rawId = form.get("id");
  const id = rawId ? idSchema.safeParse(rawId) : null;
  if (id && !id.success) return { error: "Invalid variant id." };
  const admin = createAdminClient();
  const query = id?.success
    ? admin
        .from("product_variants")
        .update(parsed.data)
        .eq("id", id.data)
        .eq("product_id", parsed.data.product_id)
    : admin.from("product_variants").insert(parsed.data);
  const { error, data } = await query.select("id").single();
  if (error || !data) return dbError(error?.code ?? "");
  revalidatePath(`/admin/products/${parsed.data.product_id}`);
  return { message: "Variant saved." };
}
export async function deleteVariant(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireRole(["admin"]);
  const id = idSchema.safeParse(form.get("id"));
  const productId = idSchema.safeParse(form.get("product_id"));
  if (!id.success || !productId.success)
    return { error: "Invalid variant id." };
  const { error, data } = await createAdminClient()
    .from("product_variants")
    .delete()
    .eq("id", id.data)
    .eq("product_id", productId.data)
    .select("id")
    .single();
  if (error || !data) return dbError(error?.code ?? "");
  revalidatePath(`/admin/products/${productId.data}`);
  return { message: "Variant removed." };
}
export async function createStaff(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireRole(["admin"]);
  const parsed = signupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return validationError(parsed.error.issues);
  try {
    await provisionUser(createAdminClient(), parsed.data, "staff");
  } catch (error) {
    return {
      error:
        error instanceof Error &&
        /already|registered|exists/i.test(error.message)
          ? "This email is already registered. Use another email."
          : "Could not create the staff account. Please try again or check the server configuration.",
    };
  }
  revalidatePath("/admin/staff");
  redirect("/admin/staff?message=created");
}
