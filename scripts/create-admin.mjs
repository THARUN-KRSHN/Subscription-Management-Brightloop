import { createClient } from "@supabase/supabase-js";

function validateInput() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password)
    throw new Error(
      "Set ADMIN_EMAIL and ADMIN_PASSWORD in .env.local before running this command.",
    );
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    password.length < 9 ||
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/[^a-zA-Z0-9]/.test(password)
  )
    throw new Error(
      "ADMIN_EMAIL must be valid and ADMIN_PASSWORD must have at least 9 characters, an uppercase letter, a lowercase letter, and a special character.",
    );
  return { email, password };
}

async function main() {
  const input = validateInput();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error(
      "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.",
    );
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: existing, error } = await admin
    .from("profiles")
    .select("id,role")
    .eq("email", input.email)
    .maybeSingle();
  if (error) throw error;
  if (existing) {
    if (existing.role === "admin") {
      console.log("This administrator already exists. No changes made.");
      return;
    }
    throw new Error(
      "Email belongs to an existing non-admin account. Use a different email; existing accounts are not promoted automatically.",
    );
  }

  const { data, error: createError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: "Brightloop Admin" },
  });
  if (createError || !data.user)
    throw new Error(createError?.message ?? "Could not create account.");
  try {
    const { error: profileError, data: profile } = await admin
      .from("profiles")
      .update({ role: "admin" })
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
  console.log(`Administrator created: ${input.email}. Log in at /login.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
