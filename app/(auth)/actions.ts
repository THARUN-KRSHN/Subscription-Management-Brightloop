"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole, roleHome } from "@/lib/auth";
import { emailSchema, passwordSchema, signupSchema } from "@/lib/validation";

export type AuthState = { error?: string; message?: string };
function configured() {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.NEXT_PUBLIC_SITE_URL
  );
}
function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL!.replace(/\/$/, "");
}
// Public authentication is intentionally exempt from requireRole: no session exists yet.
export async function login(
  _previous: AuthState,
  form: FormData,
): Promise<AuthState> {
  const parsed = z
    .object({ email: emailSchema, password: z.string().min(1) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Enter a valid email and password." };
  if (!configured())
    return {
      error:
        "Authentication is not configured yet. Follow the setup in README.md.",
    };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user)
    return {
      error:
        "Email or password is incorrect, or your email is not yet confirmed.",
    };
  const { data: profile, error: profileError } = await createAdminClient()
    .from("profiles")
    .select("role,is_active")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profileError || !profile?.is_active) {
    await supabase.auth.signOut();
    return {
      error: "This account is unavailable. Contact your administrator.",
    };
  }
  redirect(roleHome(profile.role));
}
export async function signup(
  _previous: AuthState,
  form: FormData,
): Promise<AuthState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!configured())
    return {
      error:
        "Authentication is not configured yet. Follow the setup in README.md.",
    };
  // Bounded server-only lookup, required by the friendly duplicate-email requirement.
  const { data: existing, error: lookupError } = await createAdminClient()
    .from("profiles")
    .select("id")
    .eq("email", parsed.data.email)
    .limit(1)
    .maybeSingle();
  if (lookupError)
    return { error: "We couldn’t check this email. Please try again." };
  if (existing)
    return {
      error:
        "This email is already registered. Please log in or reset your password.",
    };
  const supabase = await createClient();
  const { email, password, full_name } = parsed.data;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name },
      emailRedirectTo: `${siteUrl()}/auth/callback`,
    },
  });
  if (error)
    return {
      error: /already|registered|unique/i.test(error.message)
        ? "This email is already registered. Please log in."
        : "We couldn’t create your account. Please try again shortly.",
    };
  if (data.user?.identities?.length === 0)
    return { error: "This email is already registered. Please log in." };
  if (data.session) redirect("/portal");
  return {
    message:
      "Account created. Check your email to confirm your account, then log in.",
  };
}
export async function forgotPassword(
  _previous: AuthState,
  form: FormData,
): Promise<AuthState> {
  const parsed = emailSchema.safeParse(form.get("email"));
  if (!parsed.success) return { error: "Enter a valid email address." };
  if (!configured())
    return {
      error:
        "Authentication is not configured yet. Follow the setup in README.md.",
    };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${siteUrl()}/reset-password`,
  });
  return {
    message:
      "If an account exists for this email, you’ll receive a password reset link shortly.",
  };
}
export async function resetPassword(
  _previous: AuthState,
  form: FormData,
): Promise<AuthState> {
  await requireRole(["admin", "staff", "customer"]);
  const parsed = passwordSchema.safeParse(form.get("password"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error)
    return {
      error:
        "Couldn’t update your password. Choose a different password or request a new reset link.",
    };
  await supabase.auth.signOut();
  redirect("/login?message=password-updated");
}
export async function logout() {
  await requireRole(["admin", "staff", "customer"]);
  await (await createClient()).auth.signOut();
  redirect("/login");
}
