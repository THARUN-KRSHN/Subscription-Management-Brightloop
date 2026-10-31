import { createClient } from "@supabase/supabase-js";
import { signupSchema } from "../lib/validation.ts";
import { provisionUser } from "../lib/provision-user.ts";

async function main() {
  const input = signupSchema.parse({
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    full_name: "Brightloop Admin",
  });
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
  await provisionUser(admin, input, "admin");
  console.log(`Administrator created: ${input.email}. Log in at /login.`);
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
