import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  response.headers.set("Cache-Control", "private, no-store");
  const path = request.nextUrl.pathname;
  const protectedRoute = /^\/(admin|portal)(\/|$)/.test(path);
  function go(destination: string) {
    const result = NextResponse.redirect(new URL(destination, request.url));
    response.cookies.getAll().forEach((cookie) => result.cookies.set(cookie));
    result.headers.set("Cache-Control", "private, no-store");
    return result;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return protectedRoute ? go("/login") : response;
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values) => {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        response.headers.set("Cache-Control", "private, no-store");
      },
    },
  });
  // Recovery emails redirect directly here. Exchange PKCE code where cookies can be written.
  if (path === "/reset-password" && request.nextUrl.searchParams.has("code")) {
    const { error } = await supabase.auth.exchangeCodeForSession(
      request.nextUrl.searchParams.get("code")!,
    );
    return go(error ? "/login?error=invalid-link" : "/reset-password");
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return protectedRoute ? go("/login") : response;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return protectedRoute ? go("/login") : response;
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile } = await admin
    .from("profiles")
    .select("role,is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_active) {
    await supabase.auth.signOut();
    return protectedRoute ? go("/login?error=inactive") : response;
  }
  if (profile.role === "customer" && /^\/admin(\/|$)/.test(path))
    return go("/portal");
  if (["admin", "staff"].includes(profile.role) && /^\/portal(\/|$)/.test(path))
    return go("/admin");
  return response;
}
export const config = {
  matcher: [
    "/admin/:path*",
    "/portal/:path*",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/auth/:path*",
  ],
};
