import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { today } from "@/lib/dates";

export async function POST(request: Request) {
  const user = await requireRole(["admin", "staff"]);
  const admin = createAdminClient();

  let runDate = today();
  try {
    const body = await request.json().catch(() => ({}));
    if (body && typeof body.date === "string" && body.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      runDate = body.date;
    }
  } catch {}

  // Disallow future dates for staff; admins may also only run up to today in this demo
  const t = today();
  if (runDate > t) runDate = t;

  const { data, error } = await admin.rpc("run_billing", { p_run_date: runDate });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // run_billing returns a single row table with counts
  const row = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({ date: runDate, ...row });
}
