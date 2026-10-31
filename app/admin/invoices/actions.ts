"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionState } from "@/lib/action-state";
import { today } from "@/lib/dates";

export async function runBilling(previous: ActionState, form: FormData): Promise<ActionState> {
  await requireRole(["admin", "staff"]);
  const admin = createAdminClient();
  let date = String(form.get("date") || today());
  const t = today();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > t) date = t;
  const { data, error } = await admin.rpc("run_billing", { p_run_date: date });
  if (error) return { error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  revalidatePath("/admin/invoices");
  return { message: `Created ${row.created}, skipped ${row.skipped}, failed ${row.failed}, closed ${row.closed}` };
}

export async function confirmInvoice(previous: ActionState, form: FormData): Promise<ActionState> {
  await requireRole(["admin", "staff"]);
  const id = Number(form.get("id"));
  if (!id) return { error: "Invalid invoice id" };
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("confirm_invoice", { p_invoice_id: id });
  if (error) return { error: error.message };
  revalidatePath(`/admin/invoices/${id}`);
  revalidatePath("/admin/invoices");
  return { message: `Confirmed as ${data}` };
}

export async function cancelInvoice(previous: ActionState, form: FormData): Promise<ActionState> {
  await requireRole(["admin", "staff"]);
  const id = Number(form.get("id"));
  if (!id) return { error: "Invalid invoice id" };
  const admin = createAdminClient();
  const { error } = await admin.rpc("cancel_invoice", { p_invoice_id: id });
  if (error) return { error: error.message };
  revalidatePath(`/admin/invoices/${id}`);
  revalidatePath("/admin/invoices");
  return { message: "Invoice cancelled" };
}

export async function markSent(previous: ActionState, form: FormData): Promise<ActionState> {
  await requireRole(["admin", "staff"]);
  const id = Number(form.get("id"));
  if (!id) return { error: "Invalid invoice id" };
  const admin = createAdminClient();
  // Only allow when confirmed
  const { data: inv, error: readErr } = await admin
    .from("invoices")
    .select("id,status")
    .eq("id", id)
    .maybeSingle();
  if (readErr || !inv) return { error: readErr?.message || "Invoice not found" };
  if (inv.status !== "confirmed") return { error: "Send is allowed on confirmed invoices only" };
  const { error } = await admin.from("invoices").update({ sent_at: new Date().toISOString() }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/admin/invoices/${id}`);
  return { message: process.env.RESEND_API_KEY ? "Marked as sent (email not implemented in demo)" : "Marked as sent (email not configured)" };
}

export async function bulkConfirmDrafts(previous: ActionState): Promise<ActionState> {
  await requireRole(["admin", "staff"]);
  const admin = createAdminClient();
  const { data: drafts, error } = await admin
    .from("invoices")
    .select("id")
    .eq("status", "draft")
    .limit(500);
  if (error) return { error: error.message };
  let ok = 0, fail = 0;
  for (const row of drafts || []) {
    const { error: e } = await admin.rpc("confirm_invoice", { p_invoice_id: row.id });
    if (e) fail++; else ok++;
  }
  revalidatePath("/admin/invoices");
  return { message: `Confirmed ${ok} drafts${fail ? `, ${fail} failed` : ""}` };
}

export async function recordPayment(previous: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireRole(["admin", "staff"]);
  const id = Number(form.get("id"));
  const method = String(form.get("method"));
  const amount = Number(form.get("amount"));
  const paid_on = String(form.get("paid_on"));
  const note = String(form.get("note") || "");
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(paid_on) || !isFinite(amount)) return { error: "Invalid input" };
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("record_payment", {
    p_invoice_id: id,
    p_method: method,
    p_amount: amount,
    p_paid_on: paid_on,
    p_note: note,
    p_user: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath(`/admin/invoices/${id}`);
  revalidatePath("/admin/payments");
  return { message: `Payment recorded (#${data})` };
}
