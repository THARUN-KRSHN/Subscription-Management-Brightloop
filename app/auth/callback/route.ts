import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
// Public email verification endpoint: authorization is established by the one-time code/hash.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const supabase = await createClient();
  const result = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash &&
        (type === "recovery" || type === "signup" || type === "email")
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : null;
  const next = type === "recovery" ? "/reset-password" : "/";
  return NextResponse.redirect(
    new URL(
      result && !result.error ? next : "/login?error=invalid-link",
      url.origin,
    ),
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
