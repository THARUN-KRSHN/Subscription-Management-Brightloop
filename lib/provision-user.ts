import type { SupabaseClient } from "@supabase/supabase-js";

/** Server/CLI only. Compensates by deleting the newly-created auth user if setup fails. */
export async function provisionUser(
  admin: SupabaseClient,
  input: { email: string; password: string; full_name: string },
  role: "admin" | "staff",
) {
  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.full_name },
  });
  if (error || !data.user)
    throw new Error(error?.message ?? "Could not create account.");
  try {
    const { error: profileError, data: profile } = await admin
      .from("profiles")
      .update({ role })
      .eq("id", data.user.id)
      .select("id")
      .single();
    if (profileError || !profile)
      throw new Error("Could not assign account role.");
    const { error: customerError } = await admin
      .from("customers")
      .delete()
      .eq("profile_id", data.user.id);
    if (customerError) throw new Error("Could not finish account setup.");
  } catch (error) {
    const { error: cleanupError } = await admin.auth.admin.deleteUser(
      data.user.id,
    );
    if (cleanupError)
      throw new Error(
        `Account setup and rollback failed for ${data.user.id}. Administrator intervention is required.`,
      );
    throw error;
  }
  return data.user;
}
