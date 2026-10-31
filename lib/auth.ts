import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type Role = "admin" | "staff" | "customer";
export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  customerId: number | null;
};
export function roleHome(role: Role) {
  return role === "customer" ? "/portal" : "/admin/dashboard";
}
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  // Keep account-dependent routes dynamic even when building before env vars are configured.
  await cookies();
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
    return null;
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id,email,full_name,role,is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError)
    throw new Error("Could not verify your account. Please try again.");
  if (
    !profile ||
    !profile.is_active ||
    !["admin", "staff", "customer"].includes(profile.role)
  )
    return null;
  let customerId: number | null = null;
  if (profile.role === "customer") {
    const { data: customer, error: customerError } = await admin
      .from("customers")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();
    if (customerError || !customer) return null;
    customerId = customer.id;
  }
  return {
    id: user.id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.role,
    customerId,
  };
});
export async function requireRole(roles: Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!roles.includes(user.role)) redirect(roleHome(user.role));
  return user;
}
